//! Read the user's proxy configuration through public CFNetwork APIs.
//! No shell, preferences scraping, environment proxy or persistent helper.
//! https://developer.apple.com/documentation/cfnetwork/cfnetworkcopysystemproxysettings()
use super::SystemProxy;
use std::{ffi::c_void, io::Cursor, net::SocketAddr};

#[link(name = "CFNetwork", kind = "framework")]
extern "C" {
    fn CFNetworkCopySystemProxySettings() -> *const c_void;
}
#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRelease(value: *const c_void);
    fn CFPropertyListCreateData(
        allocator: *const c_void,
        value: *const c_void,
        format: isize,
        options: usize,
        error: *mut *const c_void,
    ) -> *const c_void;
    fn CFDataGetLength(data: *const c_void) -> isize;
    fn CFDataGetBytePtr(data: *const c_void) -> *const u8;
}
struct Owned(*const c_void);
impl Drop for Owned {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CFRelease(self.0) }
        }
    }
}

fn settings() -> Option<plist::Dictionary> {
    // Both Copy/Create results are owned. Serialization avoids untyped CF casts;
    // the bounded bytes are parsed using the project's established plist parser.
    unsafe {
        let settings = Owned(CFNetworkCopySystemProxySettings());
        if settings.0.is_null() {
            return None;
        }
        let data = Owned(CFPropertyListCreateData(
            std::ptr::null(),
            settings.0,
            200,
            0,
            std::ptr::null_mut(),
        ));
        if data.0.is_null() {
            return None;
        }
        let length = CFDataGetLength(data.0);
        if !(1..=131_072).contains(&length) {
            return None;
        }
        let bytes = CFDataGetBytePtr(data.0);
        if bytes.is_null() {
            return None;
        }
        plist::Value::from_reader(Cursor::new(std::slice::from_raw_parts(
            bytes,
            length as usize,
        )))
        .ok()?
        .into_dictionary()
    }
}
fn enabled(settings: &plist::Dictionary, key: &str) -> bool {
    settings
        .get(key)
        .is_some_and(|v| v.as_boolean() == Some(true) || v.as_unsigned_integer() == Some(1))
}
fn address(
    settings: &plist::Dictionary,
    protocol: &str,
) -> Result<Option<SocketAddr>, &'static str> {
    if !enabled(settings, &format!("{protocol}Enable")) {
        return Ok(None);
    }
    let host = settings
        .get(&format!("{protocol}Proxy"))
        .and_then(plist::Value::as_string)
        .filter(|s| !s.is_empty() && s.len() < 256 && !s.contains(['@', '/', '\\', '\r', '\n']));
    let port = settings
        .get(&format!("{protocol}Port"))
        .and_then(plist::Value::as_unsigned_integer)
        .and_then(|p| u16::try_from(p).ok())
        .filter(|p| *p > 0);
    let (Some(host), Some(port)) = (host, port) else {
        return Err("The system web proxy is invalid. Check Network settings.");
    };
    // An OS-configured proxy may legitimately be a local service or intranet
    // host. Page destinations still pass the shared public-network guard.
    if let Ok(ip) = host.trim_matches(['[', ']']).parse() {
        return Ok(Some(SocketAddr::new(ip, port)));
    }
    super::lookup(host, port)
        .ok()
        .and_then(|addresses| addresses.into_iter().next())
        .map(Some)
        .ok_or("The system web proxy could not be reached. Check Network settings.")
}
fn decode(settings: &plist::Dictionary) -> SystemProxy {
    let mut bypass = settings
        .get("ExceptionsList")
        .and_then(plist::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(plist::Value::as_string)
                .take(512)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if enabled(settings, "ExcludeSimpleHostnames") {
        bypass.push("<local>");
    }
    let mut result = SystemProxy::new(None, &bypass.join(";"));
    if enabled(settings, "ProxyAutoConfigEnable") || enabled(settings, "ProxyAutoDiscoveryEnable") {
        result.configuration_error =
            Some("Automatic proxy configuration is not supported for page previews yet.");
        return result;
    }
    let http = address(settings, "HTTP");
    let https = address(settings, "HTTPS");
    match (http, https) {
        (Ok(http), Ok(https)) => {
            result.http_address = http;
            result.address = https;
        }
        (Err(error), _) | (_, Err(error)) => result.configuration_error = Some(error),
    }
    match address(settings, "SOCKS") {
        Ok(Some(address)) => result = result.with_socks5(address),
        Ok(None) => {}
        Err(error) => result.configuration_error = Some(error),
    }
    result
}
pub(super) fn system_proxy() -> SystemProxy {
    settings()
        .as_ref()
        .map(decode)
        .unwrap_or_else(|| SystemProxy {
            configuration_error: Some("The system proxy settings could not be read. Try again."),
            ..SystemProxy::default()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn socks_only_and_mixed_protocols_follow_the_configured_proxy() {
        use super::super::ProxyEndpoint;
        let mut values = plist::Dictionary::new();
        values.insert("SOCKSEnable".into(), plist::Value::Integer(1.into()));
        values.insert("SOCKSProxy".into(), "127.0.0.1".into());
        values.insert("SOCKSPort".into(), plist::Value::Integer(1080.into()));
        values.insert(
            "ExceptionsList".into(),
            plist::Value::Array(vec!["*.example.org".into()]),
        );
        let socks = Some(ProxyEndpoint::Socks5("127.0.0.1:1080".parse().unwrap()));
        assert_eq!(decode(&values).route("public.example", 443).unwrap(), socks);
        assert_eq!(decode(&values).route("public.example", 80).unwrap(), socks);
        assert_eq!(
            decode(&values).route("docs.example.org", 443).unwrap(),
            None
        );
        values.insert("HTTPEnable".into(), plist::Value::Integer(1.into()));
        values.insert("HTTPProxy".into(), "127.0.0.1".into());
        values.insert("HTTPPort".into(), plist::Value::Integer(8123.into()));
        assert_eq!(
            decode(&values).route("public.example", 80).unwrap(),
            Some(ProxyEndpoint::Http("127.0.0.1:8123".parse().unwrap()))
        );
        assert_eq!(decode(&values).route("public.example", 443).unwrap(), socks);
    }
    #[test]
    fn separate_protocols_and_exceptions_follow_the_os_without_global_changes() {
        let mut settings = plist::Dictionary::new();
        for (key, value) in [
            ("HTTPEnable", 1),
            ("HTTPPort", 8123),
            ("HTTPSEnable", 1),
            ("HTTPSPort", 8124),
        ] {
            settings.insert(key.into(), plist::Value::Integer(value.into()));
        }
        for key in ["HTTPProxy", "HTTPSProxy"] {
            settings.insert(key.into(), "127.0.0.1".into());
        }
        settings.insert(
            "ExceptionsList".into(),
            plist::Value::Array(vec!["*.example.org".into()]),
        );
        let proxy = decode(&settings);
        assert_eq!(
            proxy.route("public.example", 80).unwrap(),
            Some(super::super::ProxyEndpoint::Http(
                "127.0.0.1:8123".parse().unwrap()
            ))
        );
        assert_eq!(
            proxy.route("public.example", 443).unwrap(),
            Some(super::super::ProxyEndpoint::Http(
                "127.0.0.1:8124".parse().unwrap()
            ))
        );
        assert_eq!(proxy.route("docs.example.org", 443).unwrap(), None);
        assert_eq!(
            decode(&plist::Dictionary::new())
                .route("public.example", 443)
                .unwrap(),
            None
        );
        settings.insert(
            "ProxyAutoConfigEnable".into(),
            plist::Value::Integer(1.into()),
        );
        assert!(
            decode(&settings).route("public.example", 443).is_err(),
            "unsupported PAC must not silently bypass the proxy"
        );
    }
}
