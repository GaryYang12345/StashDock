//! Small, bounded single-flight cache. Pasting then saving a URL must not render twice.
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
struct Capture {
    result: Mutex<Option<Result<String, String>>>,
    ready: Condvar,
    created: Instant,
}
type Entries = HashMap<String, Arc<Capture>>;
static CACHE: OnceLock<Mutex<Entries>> = OnceLock::new();
const TTL: Duration = Duration::from_secs(180);
const MAX_PENDING: usize = 2;
const MAX_ENTRIES: usize = 8;

// Reservation policy is separate from browser execution so retries, expiry and
// concurrency can be tested without starting a browser or touching user data.
fn reserve(entries: &mut Entries, url: &str, now: Instant) -> Option<Arc<Capture>> {
    entries.retain(|_, value| {
        value
            .result
            .lock()
            .map(|result| match result.as_ref() {
                None => true, // A running job owns its slot, even beyond TTL.
                Some(Ok(_)) => now.saturating_duration_since(value.created) < TTL,
                Some(Err(_)) => false, // A transient failure must be retryable now.
            })
            .unwrap_or(false)
    });
    if entries.contains_key(url) {
        return None;
    }
    if entries
        .values()
        .filter(|v| v.result.lock().map(|r| r.is_none()).unwrap_or(false))
        .count()
        >= MAX_PENDING
    {
        return None;
    }
    if entries.len() >= MAX_ENTRIES {
        if let Some(key) = entries
            .iter()
            .filter(|(_, v)| v.result.lock().map(|r| r.is_some()).unwrap_or(false))
            .min_by_key(|(_, v)| v.created)
            .map(|(k, _)| k.clone())
        {
            entries.remove(&key);
        }
    }
    let job = Arc::new(Capture {
        result: Mutex::new(None),
        ready: Condvar::new(),
        created: now,
    });
    entries.insert(url.into(), job.clone());
    Some(job)
}
fn complete(
    job: &Capture,
    render: impl FnOnce() -> Result<String, String> + std::panic::UnwindSafe,
) {
    let result = std::panic::catch_unwind(render)
        .unwrap_or_else(|_| Err("The screenshot renderer failed. Retry the lookup.".into()));
    if let Ok(mut value) = job.result.lock() {
        *value = Some(result);
        job.ready.notify_all();
    }
}
pub fn start(url: &str) {
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let job = {
        let Ok(mut entries) = cache.lock() else {
            return;
        };
        let Some(job) = reserve(&mut entries, url, Instant::now()) else {
            return;
        };
        job
    };
    let url = url.to_string();
    std::thread::spawn(move || {
        complete(&job, || {
            crate::preview_browser::capture(&url, &AtomicBool::new(false))
        });
    });
}
pub fn capture(url: &str, stop: &AtomicBool) -> Result<String, String> {
    if stop.load(Ordering::Relaxed) {
        return Err("Screenshot cancelled".into());
    }
    start(url);
    let job = CACHE
        .get()
        .and_then(|cache| cache.lock().ok()?.get(url).cloned())
        .ok_or("The preview renderer is busy.")?;
    let mut value = job
        .result
        .lock()
        .map_err(|_| "Preview could not be read.")?;
    while value.is_none()
        && job.created.elapsed() < Duration::from_secs(30)
        && !stop.load(Ordering::Relaxed)
    {
        value = job
            .ready
            .wait_timeout(value, Duration::from_millis(100))
            .map_err(|_| "Preview could not be read.")?
            .0;
    }
    if stop.load(Ordering::Relaxed) {
        return Err("Screenshot cancelled".into());
    }
    value
        .clone()
        .unwrap_or_else(|| Err("Preview timed out. Retry the lookup.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn finish(job: &Capture, result: Result<String, String>) {
        *job.result.lock().unwrap() = Some(result);
    }
    #[test]
    fn expired_running_jobs_keep_their_slots_and_cannot_duplicate() {
        let now = Instant::now();
        let mut entries = Entries::new();
        let a = reserve(&mut entries, "a", now).unwrap();
        reserve(&mut entries, "b", now).unwrap();
        assert!(reserve(&mut entries, "a", now + TTL).is_none());
        assert!(reserve(&mut entries, "c", now + TTL).is_none());
        assert!(Arc::ptr_eq(&a, &entries["a"]));
    }
    #[test]
    fn failures_retry_immediately_but_successes_remain_cached_until_expiry() {
        let now = Instant::now();
        let mut entries = Entries::new();
        let failed = reserve(&mut entries, "retry", now).unwrap();
        finish(&failed, Err("offline".into()));
        let retried = reserve(&mut entries, "retry", now).unwrap();
        assert!(!Arc::ptr_eq(&failed, &retried));
        finish(&retried, Ok("image".into()));
        assert!(reserve(&mut entries, "retry", now).is_none());
        assert!(reserve(&mut entries, "retry", now + TTL).is_some());
    }
    #[test]
    fn capacity_evicts_settled_work_not_a_pending_reservation() {
        let now = Instant::now();
        let mut entries = Entries::new();
        let pending = reserve(&mut entries, "pending", now).unwrap();
        for n in 0..MAX_ENTRIES - 1 {
            let job = reserve(&mut entries, &format!("done-{n}"), now).unwrap();
            finish(&job, Ok("image".into()));
        }
        assert!(reserve(&mut entries, "next", now).is_some());
        assert_eq!(entries.len(), MAX_ENTRIES);
        assert!(Arc::ptr_eq(&pending, &entries["pending"]));
    }
    #[test]
    fn cancelled_lookup_never_starts_a_browser() {
        assert_eq!(
            capture("https://example.com", &AtomicBool::new(true)),
            Err("Screenshot cancelled".into())
        );
    }
    #[test]
    fn renderer_panic_releases_the_reservation_for_retry() {
        let now = Instant::now();
        let mut entries = Entries::new();
        let job = reserve(&mut entries, "panic", now).unwrap();
        complete(&job, || panic!("isolated renderer fixture"));
        assert!(job.result.lock().unwrap().as_ref().unwrap().is_err());
        assert!(reserve(&mut entries, "panic", now).is_some());
    }
}
