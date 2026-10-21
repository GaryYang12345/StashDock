//! Two short-lived isolated warm renderers per process. Never the dashboard/daily browser.
//! Profile clearing and per-task proxy cancellation are mandatory before reuse.
use super::{system_webview, Cdp, PublicProxy, TempProfile};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};
const IDLE: Duration = Duration::from_secs(20);
const LIFETIME: Duration = Duration::from_secs(180);
struct Engine {
    cdp: Cdp,
    _profile: TempProfile,
    proxy: PublicProxy,
    expires: Instant,
    used: Instant,
}
type Pool = Arc<(Mutex<Option<Engine>>, Condvar)>;
static POOL: OnceLock<[Pool; 2]> = OnceLock::new();
static CREATED: AtomicUsize = AtomicUsize::new(0);
static REUSED: AtomicUsize = AtomicUsize::new(0);
pub fn statistics() -> (usize, usize) {
    (
        CREATED.load(Ordering::Relaxed),
        REUSED.load(Ordering::Relaxed),
    )
}
fn pool() -> &'static [Pool; 2] {
    POOL.get_or_init(|| {
        std::array::from_fn(|_| {
            let pool = Arc::new((Mutex::new(None::<Engine>), Condvar::new()));
            let idle = pool.clone();
            thread::spawn(move || loop {
                let (state, wake) = &*idle;
                let Ok(mut guard) = state.lock() else { return };
                let Some(engine) = guard.as_ref() else {
                    drop(wake.wait(guard));
                    continue;
                };
                let wait = IDLE
                    .saturating_sub(engine.used.elapsed())
                    .min(engine.expires.saturating_duration_since(Instant::now()));
                if wait.is_zero() {
                    let retired = guard.take();
                    drop(guard);
                    drop(retired);
                    continue;
                }
                drop(wake.wait_timeout(guard, wait));
            });
            pool
        })
    })
}
fn command(
    cdp: &mut Cdp,
    method: &str,
    params: serde_json::Value,
    deadline: Instant,
) -> Result<serde_json::Value, String> {
    let id = cdp.send(method, params)?;
    while Instant::now() < deadline {
        if let Some(event) = cdp.read()? {
            if event["id"] == id {
                return if event.get("error").is_none() {
                    Ok(event["result"].clone())
                } else {
                    Err(format!("Capture reset failed: {method}"))
                };
            }
        }
    }
    Err("The isolated renderer could not be reset in time.".into())
}
fn reset(engine: &mut Engine, deadline: Instant) -> Result<(), String> {
    let deadline = deadline.min(Instant::now() + Duration::from_secs(5));
    for (method, params) in [
        (
            "Emulation.setScriptExecutionDisabled",
            serde_json::json!({"value":true}),
        ),
        ("Page.stopLoading", serde_json::json!({})),
        ("Fetch.disable", serde_json::json!({})),
        // Leave the prior document before clearing state. In particular, a
        // hash-only next URL must never reuse the old document's JS/DOM.
        ("Page.navigate", serde_json::json!({"url":"about:blank"})),
        ("Page.disable", serde_json::json!({})),
        ("Network.disable", serde_json::json!({})),
        ("StashDock.resetProfile", serde_json::json!({})),
    ] {
        command(&mut engine.cdp, method, params, deadline)?;
    }
    // Navigate acknowledgement is not a document-commit barrier. Do not let a
    // new PDF evaluation or hash-only URL run in the previous site's document.
    loop {
        let frame = command(
            &mut engine.cdp,
            "Page.getFrameTree",
            serde_json::json!({}),
            deadline,
        )?;
        if frame["frameTree"]["frame"]["url"] == "about:blank" {
            break;
        }
        thread::sleep(Duration::from_millis(10));
    }
    engine.proxy.begin_task(deadline)?;
    command(
        &mut engine.cdp,
        "Emulation.setScriptExecutionDisabled",
        serde_json::json!({"value":false}),
        deadline,
    )
    .map(|_| ())
}
pub fn run<T>(
    stop: &AtomicBool,
    deadline: Instant,
    task: impl FnOnce(&mut Cdp) -> Result<T, String>,
) -> Result<T, String> {
    let (slot, mut guard) = loop {
        if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
            return Err("Capture cancelled or timed out.".into());
        }
        let mut available = None;
        for (slot, pool) in pool().iter().enumerate() {
            if let Ok(guard) = pool.0.try_lock() {
                available = Some((slot, guard));
                break;
            }
        }
        if let Some(available) = available {
            break available;
        }
        thread::sleep(Duration::from_millis(20));
    };
    let wake = &pool()[slot].1;
    let _permit = super::admission::acquire(stop, deadline)?;
    if guard
        .as_ref()
        .is_some_and(|e| e.expires <= deadline || e.used.elapsed() >= IDLE)
    {
        guard.take();
    }
    if let Some(engine) = guard.as_mut() {
        if reset(engine, deadline).is_err() {
            guard.take();
        } else {
            REUSED.fetch_add(1, Ordering::Relaxed);
        }
    }
    if guard.is_none() {
        let expires = Instant::now() + LIFETIME;
        let proxy = PublicProxy::start(expires)?;
        let root = std::env::var_os("STASHDOCK_CAPTURE_PROFILE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let profile = TempProfile(root.join(format!("stashdock-capture-{}", uuid::Uuid::new_v4())));
        fs::create_dir(&profile.0)
            .map_err(|_| "A temporary capture profile could not be created.")?;
        let session =
            system_webview::Session::start(profile.0.clone(), proxy.address, deadline, expires)?;
        // The session's lifetime outlasts one navigation; each task retains its own deadline.
        *guard = Some(Engine {
            cdp: Cdp { session, id: 0 },
            _profile: profile,
            proxy,
            expires,
            used: Instant::now(),
        });
        CREATED.fetch_add(1, Ordering::Relaxed);
    }
    let engine = guard.as_mut().unwrap();
    let result = task(&mut engine.cdp);
    let paused = command(
        &mut engine.cdp,
        "Emulation.setScriptExecutionDisabled",
        serde_json::json!({"value":true}),
        Instant::now() + Duration::from_secs(1),
    )
    .is_ok();
    engine.proxy.end_task();
    engine.used = Instant::now();
    if result.is_err() || !paused {
        guard.take();
    }
    wake.notify_one();
    result
}
pub fn shutdown() {
    if let Some(pools) = POOL.get() {
        for pool in pools {
            if let Ok(mut guard) = pool.0.lock() {
                guard.take();
            }
            pool.1.notify_one();
        }
    }
}
