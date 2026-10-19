//! All enrichment connections are pinned to checked public DNS results. No system proxies.
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};
use std::{
    io::Read,
    net::{IpAddr, SocketAddr, ToSocketAddrs},
    sync::{
        atomic::{AtomicUsize, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
use url::Url;
type DnsCache = HashMap<(String, u16), (Instant, Vec<SocketAddr>)>;
static DNS_CACHE: OnceLock<Mutex<DnsCache>> = OnceLock::new();

pub fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_multicast()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || ip.is_documentation()
                || a == 0
                || a >= 240
                || (a == 100 && (64..=127).contains(&b))
                || (a == 198 && (b == 18 || b == 19))
                || (a == 192 && b == 0 && c == 0))
        }
        IpAddr::V6(ip) => {
            let s = ip.segments();
            (s[0] & 0xe000) == 0x2000
                && !(s[0] == 0x2001 && (s[1] < 0x200 || s[1] == 0xdb8))
                && s[0] != 0x2002
                && !(s[0] == 0x3fff && s[1] < 0x1000)
        }
    }
}
pub fn web_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "Enter a valid http:// or https:// link.")?;
    if value.len() > 8192
        || !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || !matches!(url.port_or_known_default(), Some(80 | 443))
    {
        return Err("Automatic previews support public web links on standard ports only.".into());
    }
    Ok(url)
}
static RESOLVING: AtomicUsize = AtomicUsize::new(0);
pub fn resolve_public(host: &str, port: u16) -> Result<Vec<SocketAddr>, String> {
    if !matches!(port, 80 | 443) {
        return Err("Unsupported web port.".into());
    }
    let host = host.trim_matches(['[', ']']);
    let key = (host.to_ascii_lowercase(), port);
    let cache = DNS_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(cache) = cache.lock() {
        if let Some((time, addresses)) = cache.get(&key) {
            if time.elapsed() < Duration::from_secs(60) {
                return Ok(addresses.clone());
            }
        }
    }
    if !host.contains('.') && host.parse::<IpAddr>().is_err() {
        return Err("Local hostnames are not previewed.".into());
    }
    let addresses = if let Ok(ip) = host.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        // OS name resolution is blocking. Bound the wait and the number of leftover
        // resolver threads if the system resolver itself stalls.
        if RESOLVING
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |count| {
                (count < 4).then_some(count + 1)
            })
            .is_err()
        {
            return Err("Website name resolution is busy.".into());
        }
        let host = host.to_string();
        let (send, receive) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let result = (host.as_str(), port)
                .to_socket_addrs()
                .map(|values| values.collect::<Vec<_>>());
            RESOLVING.fetch_sub(1, Ordering::Relaxed);
            let _ = send.send(result);
        });
        receive
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "Website name resolution timed out.")?
            .map_err(|_| "This website could not be reached.")?
    };
    if addresses.is_empty() || addresses.iter().any(|address| !public_ip(address.ip())) {
        return Err("Automatic previews are only available for public websites.".into());
    }
    if let Ok(mut cache) = cache.lock() {
        if cache.len() >= 128 {
            cache.retain(|_, (time, _)| time.elapsed() < Duration::from_secs(60));
        }
        if cache.len() < 128 {
            cache.insert(key, (Instant::now(), addresses.clone()));
        }
    }
    Ok(addresses)
}
pub struct WebResponse {
    pub url: Url,
    pub content_type: String,
    pub bytes: Vec<u8>,
}
pub fn fetch(
    value: &str,
    limit: usize,
    accept: &str,
    deadline: Instant,
) -> Result<WebResponse, String> {
    fetch_with_policy(value, limit, accept, deadline, false)
}
// Detect a document before applying limits. HTML metadata only needs a bounded
// prefix; a PDF needs a separate binary budget and must never enter the HTML parser.
pub fn fetch_document(value: &str, deadline: Instant) -> Result<WebResponse, String> {
    fetch_with_policy(
        value,
        2_000_000,
        "text/html,application/xhtml+xml,application/pdf",
        deadline,
        true,
    )
}
fn fetch_with_policy(
    value: &str,
    limit: usize,
    accept: &str,
    deadline: Instant,
    document: bool,
) -> Result<WebResponse, String> {
    let mut url = web_url(value)?;
    'redirect: for _ in 0..5 {
        let host = url.host_str().unwrap().trim_matches(['[', ']']);
        let addresses = resolve_public(host, url.port_or_known_default().unwrap())?;
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        let mut last_error =
            "Page details could not be read. Retry the lookup or enter them manually.".to_string();
        for address in addresses
            .iter()
            .take(4)
            .cycle()
            .take(addresses.len().min(4) * 2)
        {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                break;
            }
            let client = reqwest::blocking::Client::builder();
            // Match the OS certificate/TLS stack on Windows. Keep hostname and
            // certificate verification, pinned DNS and the no-proxy boundary intact.
            #[cfg(windows)]
            let client = client.tls_backend_native();
            let client = client
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .resolve_to_addrs(host, &[*address])
                .timeout(remaining.min(Duration::from_secs(9)))
                .connect_timeout(Duration::from_secs(3))
                .user_agent("StashDock/0.2.1 WebPreview")
                .build()
                .map_err(|_| "Web preview is unavailable.")?;
            let response = client
                .get(url.clone())
                .header("Accept", accept)
                .header("Accept-Encoding", "identity")
                .send();
            let mut response = match response {
                Ok(response) => response,
                Err(error) => {
                    if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                        eprintln!("Preview transport for {host} at {address}: {error:?}");
                    }
                    continue;
                }
            };
            if response.status().is_redirection() {
                let location = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .ok_or("Invalid redirect.")?;
                url = web_url(
                    url.join(location)
                        .map_err(|_| "Invalid redirect.")?
                        .as_str(),
                )?;
                continue 'redirect;
            }
            if !response.status().is_success() {
                return Err("This website requires access or is unavailable.".into());
            }
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_ascii_lowercase();
            let mut prefix = Vec::with_capacity(64);
            if let Err(error) = response.by_ref().take(64).read_to_end(&mut prefix) {
                if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                    eprintln!("Preview body for {host} at {address}: {error:?}");
                }
                last_error =
                    "Page details could not be read. Retry the lookup or enter them manually."
                        .into();
                continue;
            }
            let pdf = document && is_pdf(&content_type, &prefix);
            let limit = if pdf { 32 * 1024 * 1024 } else { limit };
            let strict = !document || pdf;
            if strict && response.content_length().is_some_and(|n| n > limit as u64) {
                return Err(if pdf { "This PDF exceeds the 32 MB automatic-reading limit. Save its link or enter its details manually." } else { "Web image is too large." }.into());
            }
            let mut bytes = prefix;
            if let Err(error) = response
                .take(limit.saturating_sub(bytes.len()) as u64 + u64::from(strict))
                .read_to_end(&mut bytes)
            {
                // A successful response header is not a successful lookup. Retry
                // an interrupted body on another checked endpoint; never save it.
                if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                    eprintln!("Preview body for {host} at {address}: {error:?}");
                }
                continue;
            }
            if strict && bytes.len() > limit {
                return Err(if pdf { "This PDF exceeds the 32 MB automatic-reading limit. Save its link or enter its details manually." } else { "Web image is too large." }.into());
            }
            if let Ok(mut cache) = DNS_CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock() {
                if let Some((_, values)) = cache.get_mut(&(
                    host.to_ascii_lowercase(),
                    url.port_or_known_default().unwrap(),
                )) {
                    values.sort_by_key(|value| value != address);
                }
            }
            return Ok(WebResponse {
                url,
                content_type,
                bytes,
            });
        }
        return Err(last_error);
    }
    Err("This website took too long to resolve.".into())
}

fn is_pdf(content_type: &str, prefix: &[u8]) -> bool {
    content_type.contains("application/pdf") || prefix.starts_with(b"%PDF-")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pdf_detection_uses_the_document_type_and_binary_signature() {
        assert!(is_pdf("application/pdf; charset=binary", b"%PDF-1.7"));
        assert!(is_pdf("application/octet-stream", b"%PDF-1.7"));
        assert!(!is_pdf("text/html", b"<!DOCTYPE html>"));
    }
    #[test]
    fn rejects_special_addresses_ports_credentials_and_schemes() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "100.64.0.1",
            "198.18.0.1",
            "192.0.2.1",
            "::1",
            "::ffff:8.8.8.8",
            "2001:db8::1",
            "2002:0808:0808::",
            "3fff::1",
            "fc00::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()), "{ip}");
        }
        assert!(public_ip("8.8.8.8".parse().unwrap()));
        assert!(public_ip("2606:4700::1111".parse().unwrap()));
        for value in [
            "file:///secret",
            "https://user:pass@example.org",
            "http://example.org:22",
        ] {
            assert!(web_url(value).is_err());
        }
        assert!(resolve_public("localhost", 80).is_err());
        assert!(resolve_public("127.0.0.1", 80).is_err());
    }
}
