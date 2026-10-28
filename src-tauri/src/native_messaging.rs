//! Firefox's browser-owned caller check, followed by the existing capture RPC.
//! No browser profile reads, library routing, arbitrary URLs or resident daemon.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};

fn config() -> Value {
    serde_json::from_str(include_str!("../product-links.json")).expect("valid product links")
}
pub fn host_name() -> String {
    config()["browserExtensions"]["firefox"]["nativeHost"]
        .as_str()
        .expect("Firefox host")
        .to_owned()
}
pub fn extension_id() -> String {
    config()["browserExtensions"]["firefox"]["id"]
        .as_str()
        .expect("Firefox identity")
        .to_owned()
}
pub fn origin() -> String {
    format!("stashdock-firefox-native://{}", host_name())
}
pub fn trusted_origin(value: &str) -> bool {
    value == origin()
}

const MAX_MESSAGE: usize = 2 * 1024 * 1024;
const MAX_RESPONSE: u64 = 256 * 1024;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    method: String,
    path: String,
    body: String,
    port: u16,
}
#[derive(Serialize)]
struct Reply {
    status: u16,
    body: String,
}
impl Reply {
    fn error(status: u16, error: &str) -> Self {
        Self {
            status,
            body: json!({"error":error}).to_string(),
        }
    }
}
fn valid(request: &Request) -> bool {
    [17863, 17864].contains(&request.port)
        && request.body.len() <= 1_000_000
        && request.path.len() <= 8192
        && !request.path.bytes().any(|v| v < 32 || v == b'#')
        && match request.method.as_str() {
            "GET" => request.path == "/v1/health",
            "POST" => ["/v1/setup", "/v1/capture", "/v1/tags", "/v1/capture/lookup"]
                .contains(&request.path.as_str()),
            _ => false,
        }
}
fn relay(mut request: Request) -> Reply {
    if !valid(&request) {
        return Reply::error(400, "Invalid StashDock request.");
    }
    if request.path == "/v1/setup" {
        let value: Value = match serde_json::from_str(&request.body) {
            Ok(value) => value,
            Err(_) => return Reply::error(400, "Invalid setup request."),
        };
        let Some(version) = value["version"].as_str().filter(|v| {
            !v.is_empty()
                && v.len() <= 40
                && v.bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"._+-".contains(&c))
        }) else {
            return Reply::error(400, "Invalid setup request.");
        };
        // The browser validates allowed_extensions, and supplies the caller ID
        // as a process argument. Never use an extension's asserted identity.
        request.body =
            json!({"browser":"firefox","extensionId":extension_id(),"version":version}).to_string();
    }
    let result = (|| -> Result<Reply, Box<dyn std::error::Error>> {
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_millis(500))
            .timeout(Duration::from_secs(5))
            .build()?;
        let method = reqwest::Method::from_bytes(request.method.as_bytes())?;
        let response = client
            .request(
                method,
                format!("http://127.0.0.1:{}{}", request.port, request.path),
            )
            .header("Content-Type", "application/json")
            .header("X-StashDock-Client", "chrome-extension-v1")
            .header("Origin", origin())
            .body(request.body)
            .send()?;
        let status = response.status().as_u16();
        let mut body = String::new();
        response.take(MAX_RESPONSE + 1).read_to_string(&mut body)?;
        if body.len() as u64 > MAX_RESPONSE {
            return Ok(Reply::error(502, "The StashDock response is too large."));
        }
        Ok(Reply { status, body })
    })();
    result.unwrap_or_else(|_| {
        Reply::error(503, "Open StashDock Desktop or its AI plugin, then retry.")
    })
}
fn read_message(input: &mut impl Read) -> Result<Request, String> {
    let mut prefix = [0u8; 4];
    input
        .read_exact(&mut prefix)
        .map_err(|_| "Incomplete native message.")?;
    let size = u32::from_ne_bytes(prefix) as usize;
    if size == 0 || size > MAX_MESSAGE {
        return Err("Native message is too large.".into());
    }
    let mut body = vec![0; size];
    input
        .read_exact(&mut body)
        .map_err(|_| "Incomplete native message.")?;
    serde_json::from_slice(&body).map_err(|_| "Invalid native message.".into())
}
fn write_message(output: &mut impl Write, reply: &Reply) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(reply)?;
    output.write_all(&(bytes.len() as u32).to_ne_bytes())?;
    output.write_all(&bytes)?;
    output.flush()
}
pub fn run_if_invoked() -> bool {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.is_empty() {
        return false;
    }
    let expected = format!("{}.json", host_name());
    if args.len() != 2
        || !Path::new(&args[0]).is_absolute()
        || Path::new(&args[0]).file_name() != Some(std::ffi::OsStr::new(&expected))
        || args[1] != extension_id().as_str()
    {
        eprintln!("Unsupported native messaging caller.");
        std::process::exit(1);
    }
    // sendNativeMessage launches a short-lived process for each bounded RPC.
    // There is no idle process, alternate database or automatic Save replay.
    let reply = match read_message(&mut std::io::stdin().lock()) {
        Ok(request) => relay(request),
        Err(error) => Reply::error(400, &error),
    };
    if write_message(&mut std::io::stdout().lock(), &reply).is_err() {
        std::process::exit(1);
    }
    true
}
fn write_manifest(directory: &Path, helper: &Path) -> Result<PathBuf, String> {
    if !helper.is_absolute() || !helper.is_file() {
        return Err("The StashDock helper is unavailable.".into());
    }
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let path = directory.join(format!("{}.json", host_name()));
    let bytes = serde_json::to_vec_pretty(&json!({"name":host_name(),"description":"StashDock Firefox capture","path":helper,"type":"stdio","allowed_extensions":[extension_id()]})).map_err(|e|e.to_string())?;
    if fs::read(&path).ok().as_deref() != Some(&bytes) {
        let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
        fs::write(&temporary, &bytes).map_err(|e| e.to_string())?;
        fs::rename(&temporary, &path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}
pub fn register(helper: &Path) -> Result<PathBuf, String> {
    if std::env::var("STASHDOCK_NATIVE_HOST_REGISTRATION").as_deref() == Ok("off") {
        return Err("Native host registration is disabled.".into());
    }
    #[cfg(target_os = "macos")]
    let directory = PathBuf::from(std::env::var_os("HOME").ok_or("Home folder unavailable.")?)
        .join("Library/Application Support/Mozilla/NativeMessagingHosts");
    #[cfg(windows)]
    let directory =
        PathBuf::from(std::env::var_os("APPDATA").ok_or("App data folder unavailable.")?)
            .join("StashDock/NativeMessagingHosts");
    #[cfg(not(any(windows, target_os = "macos")))]
    let directory = PathBuf::from(std::env::var_os("HOME").ok_or("Home folder unavailable.")?)
        .join(".mozilla/native-messaging-hosts");
    let path = write_manifest(&directory, helper)?;
    #[cfg(windows)]
    register_windows(&path)?;
    Ok(path)
}
#[cfg(windows)]
fn register_windows(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::*;
    let key_name: Vec<u16> = format!("Software\\Mozilla\\NativeMessagingHosts\\{}", host_name())
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let value: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut key = std::ptr::null_mut();
    unsafe {
        if RegCreateKeyExW(
            HKEY_CURRENT_USER,
            key_name.as_ptr(),
            0,
            std::ptr::null_mut(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            std::ptr::null(),
            &mut key,
            std::ptr::null_mut(),
        ) != 0
        {
            return Err("Firefox connection could not be registered.".into());
        }
        let status = RegSetValueExW(
            key,
            std::ptr::null(),
            0,
            REG_SZ,
            value.as_ptr().cast(),
            (value.len() * 2) as u32,
        );
        RegCloseKey(key);
        if status != 0 {
            return Err("Firefox connection could not be registered.".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_capture_rpc_reaches_fixed_loopback_providers() {
        for port in [17863, 17864] {
            for path in ["/v1/setup", "/v1/capture", "/v1/tags", "/v1/capture/lookup"] {
                assert!(valid(&Request {
                    method: "POST".into(),
                    path: path.into(),
                    body: "{}".into(),
                    port
                }));
            }
        }
        for path in [
            "//evil.example/",
            "/v1/setup?host=evil",
            "/v1/capture/../delete",
            "/items",
            "/v1/capture#x",
            "/v1/health\r\nHost: evil",
        ] {
            assert!(!valid(&Request {
                method: "POST".into(),
                path: path.into(),
                body: "{}".into(),
                port: 17863
            }));
        }
        assert!(!valid(&Request {
            method: "POST".into(),
            path: "/v1/setup".into(),
            body: "{}".into(),
            port: 17865
        }));
    }
    #[test]
    fn framing_is_binary_bounded_and_rejects_extra_fields() {
        let raw = br#"{"method":"GET","path":"/v1/health","body":"","port":17863}"#;
        let mut input = (raw.len() as u32).to_ne_bytes().to_vec();
        input.extend(raw);
        assert!(valid(&read_message(&mut input.as_slice()).unwrap()));
        for input in [vec![0; 4], vec![255; 4], vec![8, 0, 0, 0, b'{']] {
            assert!(read_message(&mut input.as_slice()).is_err());
        }
        let mut out = Vec::new();
        write_message(&mut out, &Reply::error(400, "中文")).unwrap();
        assert_eq!(
            u32::from_ne_bytes(out[..4].try_into().unwrap()) as usize,
            out.len() - 4
        );
        assert!(serde_json::from_slice::<Request>(
            br#"{"method":"GET","path":"/v1/health","body":"","port":17863,"host":"evil"}"#
        )
        .is_err());
    }
    #[test]
    fn registration_is_exact_and_unchanged_bytes_keep_the_same_file() {
        let root =
            std::env::temp_dir().join(format!("stashdock-native-host-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let helper = root.join("storage helper");
        fs::write(&helper, "fixture").unwrap();
        let path = write_manifest(&root.join("hosts"), &helper).unwrap();
        let before = fs::metadata(&path).unwrap().modified().unwrap();
        assert_eq!(write_manifest(&root.join("hosts"), &helper).unwrap(), path);
        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), before);
        let value: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(value["allowed_extensions"], json!([extension_id()]));
        assert_eq!(value["path"], json!(helper));
        fs::remove_dir_all(root).unwrap();
    }
}
