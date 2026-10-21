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

// A client owns its connection pool and blocking runtime. Reuse a bounded set,
// keyed by the exact checked endpoint, never an unchecked hostname resolver.
struct ClientEntry {
    host: String,
    address: SocketAddr,
    used: Instant,
    client: reqwest::blocking::Client,
}
#[derive(Default)]
struct ClientPool(Vec<ClientEntry>);
const CLIENT_IDLE: Duration = Duration::from_secs(30);
const MAX_CLIENTS: usize = 4;
impl ClientPool {
    fn get(
        &mut self,
        host: &str,
        address: SocketAddr,
        now: Instant,
    ) -> Result<reqwest::blocking::Client, String> {
        self.0
            .retain(|entry| now.saturating_duration_since(entry.used) < CLIENT_IDLE);
        if let Some(entry) = self
            .0
            .iter_mut()
            .find(|entry| entry.host == host && entry.address == address)
        {
            entry.used = now;
            return Ok(entry.client.clone());
        }
        let client = build_client(host, address)?;
        if self.0.len() >= MAX_CLIENTS {
            let oldest = self
                .0
                .iter()
                .enumerate()
                .min_by_key(|(_, entry)| entry.used)
                .unwrap()
                .0;
            self.0.swap_remove(oldest);
        }
        self.0.push(ClientEntry {
            host: host.into(),
            address,
            used: now,
            client: client.clone(),
        });
        Ok(client)
    }
}
fn build_client(host: &str, address: SocketAddr) -> Result<reqwest::blocking::Client, String> {
    let client = reqwest::blocking::Client::builder();
    #[cfg(windows)]
    let client = client.tls_backend_native();
    client
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .resolve_to_addrs(host, &[address])
        .connect_timeout(Duration::from_secs(3))
        .pool_idle_timeout(CLIENT_IDLE)
        .pool_max_idle_per_host(2)
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .no_zstd()
        .user_agent("StashDock/0.2.1 WebPreview")
        .build()
        .map_err(|_| "Web preview is unavailable.".into())
}
fn client_for(host: &str, address: SocketAddr) -> Result<reqwest::blocking::Client, String> {
    if !public_ip(address.ip()) || !matches!(address.port(), 80 | 443) {
        return Err("Automatic previews are only available for public websites.".into());
    }
    static CLIENTS: OnceLock<Mutex<ClientPool>> = OnceLock::new();
    CLIENTS
        .get_or_init(|| Mutex::new(ClientPool::default()))
        .lock()
        .map_err(|_| "Web preview is unavailable.".to_string())?
        .get(host, address, Instant::now())
}
fn decoded_body(response: reqwest::blocking::Response) -> Result<Box<dyn Read>, String> {
    let encoding = response
        .headers()
        .get(reqwest::header::CONTENT_ENCODING)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    decode_reader(&encoding, response)
}
fn decode_reader(encoding: &str, reader: impl Read + 'static) -> Result<Box<dyn Read>, String> {
    match encoding {
        "" | "identity" => Ok(Box::new(reader)),
        "gzip" => Ok(Box::new(flate2::read::MultiGzDecoder::new(reader))),
        "br" => Ok(Box::new(brotli::Decompressor::new(reader, 4096))),
        _ => Err("This website returned an unsupported document encoding.".into()),
    }
}

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
pub fn remember_endpoint(host: &str, port: u16, address: SocketAddr) {
    if let Ok(mut cache) = DNS_CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock() {
        if let Some((_, values)) =
            cache.get_mut(&(host.trim_matches(['[', ']']).to_ascii_lowercase(), port))
        {
            // Reorder only already checked addresses; never admit a new target.
            values.sort_by_key(|value| *value != address);
        }
    }
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
    fetch_with_policy(value, limit, accept, deadline, DocumentPolicy::Raster)
}
#[derive(Clone, Copy, PartialEq)]
enum DocumentPolicy {
    Raster,
    Preview,
    Context,
}
impl DocumentPolicy {
    fn skips_body(self, content_type: &str, prefix: &[u8]) -> bool {
        self == Self::Context && is_pdf(content_type, prefix)
    }
}
// Detect a document before applying limits. HTML metadata only needs a bounded
// prefix; a PDF needs a separate binary budget and must never enter the HTML parser.
pub fn fetch_document(value: &str, deadline: Instant) -> Result<WebResponse, String> {
    fetch_with_policy(
        value,
        2_000_000,
        "text/html,application/xhtml+xml,application/pdf",
        deadline,
        DocumentPolicy::Preview,
    )
}
// Context is a lightweight introduction, not a PDF reader. Sniff the response
// before downloading the body so extensionless PDF links are covered too.
pub fn fetch_context_document(value: &str, deadline: Instant) -> Result<WebResponse, String> {
    fetch_with_policy(
        value,
        2_000_000,
        "text/html,application/xhtml+xml,application/pdf",
        deadline,
        DocumentPolicy::Context,
    )
}
fn fetch_with_policy(
    value: &str,
    limit: usize,
    accept: &str,
    deadline: Instant,
    policy: DocumentPolicy,
) -> Result<WebResponse, String> {
    let document = policy != DocumentPolicy::Raster;
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
        // An address that refused or timed out is not tried again: retrying the
        // same unreachable host only doubled the wait before a page could fail.
        let mut unreachable = Vec::new();
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
            if unreachable.contains(address) {
                continue;
            }
            let client = client_for(host, *address)?;
            let request = client
                .get(url.clone())
                .header("Accept", accept)
                .timeout(remaining.min(Duration::from_secs(9)));
            // Document limits below apply to decompressed bytes too. Raster
            // downloads keep their existing wire representation and limits.
            let request = if document {
                request.header("Accept-Encoding", "gzip, br")
            } else {
                request.header("Accept-Encoding", "identity")
            };
            let response = request.send();
            let response = match response {
                Ok(response) => response,
                Err(error) => {
                    if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                        eprintln!("Preview transport for {host} at {address}: {error:?}");
                    }
                    if error.is_connect() || error.is_timeout() {
                        unreachable.push(*address);
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
            if policy.skips_body(&content_type, &[]) {
                return Ok(WebResponse {
                    url,
                    content_type: "application/pdf".into(),
                    bytes: Vec::new(),
                });
            }
            let content_length = response.content_length();
            let mut body = decoded_body(response)?;
            let mut prefix = Vec::with_capacity(64);
            if let Err(error) = body.by_ref().take(64).read_to_end(&mut prefix) {
                if std::env::var_os("STASHDOCK_PREVIEW_DIAGNOSTICS").is_some() {
                    eprintln!("Preview body for {host} at {address}: {error:?}");
                }
                last_error =
                    "Page details could not be read. Retry the lookup or enter them manually."
                        .into();
                continue;
            }
            let pdf = document && is_pdf(&content_type, &prefix);
            if policy.skips_body(&content_type, &prefix) {
                return Ok(WebResponse {
                    url,
                    content_type: "application/pdf".into(),
                    bytes: Vec::new(),
                });
            }
            let limit = if pdf { 5 * 1024 * 1024 } else { limit };
            let strict = !document || pdf;
            if strict && content_length.is_some_and(|n| n > limit as u64) {
                return Err(if pdf {
                    "This PDF exceeds the automatic-cover size limit."
                } else {
                    "Web image is too large."
                }
                .into());
            }
            let mut bytes = prefix;
            if let Err(error) = body
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
                return Err(if pdf {
                    "This PDF exceeds the automatic-cover size limit."
                } else {
                    "Web image is too large."
                }
                .into());
            }
            remember_endpoint(host, url.port_or_known_default().unwrap(), *address);
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
    fn compressed_reads_are_bounded_after_decoding_and_reject_invalid_streams() {
        let gzip = vec![
            31, 139, 8, 0, 0, 0, 0, 0, 0, 10, 75, 206, 207, 45, 40, 74, 45, 46, 78, 77, 81, 72,
            203, 172, 40, 41, 45, 74, 85, 72, 202, 79, 169, 4, 0, 65, 61, 18, 88, 23, 0, 0, 0,
        ];
        let brotli = vec![
            11, 11, 128, 99, 111, 109, 112, 114, 101, 115, 115, 101, 100, 32, 102, 105, 120, 116,
            117, 114, 101, 32, 98, 111, 100, 121, 3,
        ];
        for (encoding, bytes) in [("gzip", gzip), ("br", brotli)] {
            let mut bounded = Vec::new();
            decode_reader(encoding, std::io::Cursor::new(bytes))
                .unwrap()
                .take(5)
                .read_to_end(&mut bounded)
                .unwrap();
            assert_eq!(bounded, b"compr");
        }
        assert!(decode_reader("unknown", std::io::Cursor::new(Vec::new())).is_err());
        let mut invalid = Vec::new();
        assert!(
            decode_reader("gzip", std::io::Cursor::new(b"invalid".to_vec()))
                .unwrap()
                .read_to_end(&mut invalid)
                .is_err()
        );
    }
    #[test]
    fn context_skips_pdf_headers_or_signature_without_a_full_binary_download() {
        assert!(DocumentPolicy::Context.skips_body("application/pdf", &[]));
        assert!(DocumentPolicy::Context.skips_body("application/octet-stream", b"%PDF-1.7"));
        assert!(!DocumentPolicy::Context.skips_body("text/html", b"<html>"));
        assert!(!DocumentPolicy::Preview.skips_body("application/pdf", b"%PDF-1.7"));
        assert!(!DocumentPolicy::Raster.skips_body("image/png", &[]));
    }
    #[test]
    fn endpoint_clients_are_bounded_expire_and_never_accept_private_destinations() {
        let mut pool = ClientPool::default();
        let now = Instant::now();
        for index in 1..=8 {
            let address = format!("8.8.8.{index}:443").parse().unwrap();
            pool.get("fixture.example", address, now).unwrap();
            assert!(pool.0.len() <= MAX_CLIENTS);
        }
        let address = "8.8.8.8:443".parse().unwrap();
        pool.get("fixture.example", address, now).unwrap();
        assert_eq!(
            pool.0
                .iter()
                .filter(|entry| entry.address == address)
                .count(),
            1
        );
        pool.get("new.example", address, now + CLIENT_IDLE).unwrap();
        assert_eq!(pool.0.len(), 1);
        assert_eq!(pool.0[0].host, "new.example");
        assert!(client_for("fixture.example", "127.0.0.1:80".parse().unwrap()).is_err());
        assert!(client_for("fixture.example", "8.8.8.8:1234".parse().unwrap()).is_err());
    }
    #[test]
    fn pinned_client_reuses_a_connection_and_decodes_compressed_document_bytes() {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        // Only this unit test constructs a client directly for a loopback fixture.
        // Production client_for rejects private endpoints before pool access.
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let compressed: &[u8] = &[
                31, 139, 8, 0, 0, 0, 0, 0, 0, 10, 75, 206, 207, 45, 40, 74, 45, 46, 78, 77, 81, 72,
                203, 172, 40, 41, 45, 74, 85, 72, 202, 79, 169, 4, 0, 65, 61, 18, 88, 23, 0, 0, 0,
            ];
            for _ in 0..2 {
                let mut header = Vec::new();
                while !header.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).unwrap();
                    header.push(byte[0]);
                }
                let header = String::from_utf8(header).unwrap().to_ascii_lowercase();
                assert!(header
                    .lines()
                    .any(|line| line.starts_with("accept-encoding:") && line.contains("gzip")));
                write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n", compressed.len()).unwrap();
                stream.write_all(compressed).unwrap();
                stream.flush().unwrap();
            }
        });
        let client = build_client("fixture.test", address).unwrap();
        for path in ["one", "two"] {
            let response = client
                .get(format!("http://fixture.test:{}/{path}", address.port()))
                .header("Accept-Encoding", "gzip, br")
                .timeout(Duration::from_secs(5))
                .send()
                .unwrap();
            let mut body = String::new();
            decoded_body(response)
                .unwrap()
                .read_to_string(&mut body)
                .unwrap();
            assert_eq!(body, "compressed fixture body");
        }
        server.join().unwrap();
    }
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
