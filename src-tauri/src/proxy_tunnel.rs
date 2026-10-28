//! Bounded TCP tunnels for the isolated renderer. Proxy configuration belongs
//! to public_web; this module never resolves the destination or falls back to
//! a direct connection. Both HTTP CONNECT and SOCKS5 preserve proxy-side DNS.
use crate::public_web::ProxyEndpoint;
use std::{
    io::{self, Read, Write},
    net::{IpAddr, TcpStream},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

fn remaining(deadline: Instant, stop: &AtomicBool) -> Result<Duration, String> {
    let duration = deadline.saturating_duration_since(Instant::now());
    if stop.load(Ordering::Relaxed) || duration.is_zero() {
        Err("Capture ended.".into())
    } else {
        Ok(duration.min(Duration::from_millis(200)))
    }
}
fn transient(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
    )
}
fn receive(
    stream: &mut TcpStream,
    mut bytes: &mut [u8],
    deadline: Instant,
    stop: &AtomicBool,
) -> Result<(), String> {
    while !bytes.is_empty() {
        stream
            .set_read_timeout(Some(remaining(deadline, stop)?))
            .map_err(|_| "System proxy unavailable.")?;
        match stream.read(bytes) {
            Ok(0) => return Err("System proxy closed the connection.".into()),
            Ok(count) => bytes = &mut bytes[count..],
            Err(error) if transient(&error) => {}
            Err(_) => return Err("System proxy unavailable.".into()),
        }
    }
    Ok(())
}
fn send(
    stream: &mut TcpStream,
    mut bytes: &[u8],
    deadline: Instant,
    stop: &AtomicBool,
) -> Result<(), String> {
    while !bytes.is_empty() {
        stream
            .set_write_timeout(Some(remaining(deadline, stop)?))
            .map_err(|_| "System proxy unavailable.")?;
        match stream.write(bytes) {
            Ok(0) => return Err("System proxy closed the connection.".into()),
            Ok(count) => bytes = &bytes[count..],
            Err(error) if transient(&error) => {}
            Err(_) => return Err("System proxy unavailable.".into()),
        }
    }
    Ok(())
}

pub(super) fn connect(
    proxy: ProxyEndpoint,
    target: &str,
    deadline: Instant,
    stop: &AtomicBool,
) -> Result<TcpStream, String> {
    remaining(deadline, stop)?;
    let timeout = deadline
        .saturating_duration_since(Instant::now())
        .min(Duration::from_secs(2));
    let mut stream = TcpStream::connect_timeout(&proxy.address(), timeout)
        .map_err(|_| "System proxy unavailable.")?;
    match proxy {
        ProxyEndpoint::Http(_) => {
            send(
                &mut stream,
                format!(
                    "CONNECT {target} HTTP/1.1\r\nHost: {target}\r\nConnection: keep-alive\r\n\r\n"
                )
                .as_bytes(),
                deadline,
                stop,
            )?;
            let mut response = Vec::new();
            while response.len() < 16384 && !response.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                receive(&mut stream, &mut byte, deadline, stop)?;
                response.push(byte[0]);
            }
            if !response.ends_with(b"\r\n\r\n")
                || !String::from_utf8_lossy(&response)
                    .lines()
                    .next()
                    .is_some_and(|line| line.split_whitespace().nth(1) == Some("200"))
            {
                return Err("System proxy declined the connection.".into());
            }
        }
        ProxyEndpoint::Socks5(_) => {
            let url = url::Url::parse(&format!("http://{target}"))
                .map_err(|_| "Invalid proxy destination.")?;
            let host = url
                .host_str()
                .ok_or("Invalid proxy destination.")?
                .trim_matches(['[', ']']);
            let port = url
                .port_or_known_default()
                .ok_or("Invalid proxy destination.")?;
            if !url.username().is_empty()
                || url.password().is_some()
                || url.path() != "/"
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err("Invalid proxy destination.".into());
            }
            send(&mut stream, &[5, 1, 0], deadline, stop)?;
            let mut selected = [0; 2];
            receive(&mut stream, &mut selected, deadline, stop)?;
            if selected != [5, 0] {
                return Err("The system SOCKS proxy requires unsupported authentication.".into());
            }
            let mut request = vec![5, 1, 0];
            match host.parse::<IpAddr>() {
                Ok(IpAddr::V4(address)) => {
                    request.push(1);
                    request.extend_from_slice(&address.octets());
                }
                Ok(IpAddr::V6(address)) => {
                    request.push(4);
                    request.extend_from_slice(&address.octets());
                }
                Err(_) if host.len() <= 253 && host.is_ascii() => {
                    request.extend_from_slice(&[3, host.len() as u8]);
                    request.extend_from_slice(host.as_bytes());
                }
                _ => return Err("Invalid proxy destination.".into()),
            }
            request.extend_from_slice(&port.to_be_bytes());
            send(&mut stream, &request, deadline, stop)?;
            let mut header = [0; 4];
            receive(&mut stream, &mut header, deadline, stop)?;
            if header[0] != 5 || header[1] != 0 || header[2] != 0 {
                return Err("System proxy declined the connection.".into());
            }
            let length = match header[3] {
                1 => 4,
                4 => 16,
                3 => {
                    let mut length = [0];
                    receive(&mut stream, &mut length, deadline, stop)?;
                    if length[0] == 0 {
                        return Err("Invalid SOCKS proxy response.".into());
                    }
                    length[0] as usize
                }
                _ => return Err("Invalid SOCKS proxy response.".into()),
            };
            receive(&mut stream, &mut vec![0; length + 2], deadline, stop)?;
        }
    }
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, thread};
    #[test]
    fn socks_preserves_hostname_and_handles_fragmented_reply_without_reading_payload() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut greeting = [0; 3];
            socket.read_exact(&mut greeting).unwrap();
            assert_eq!(greeting, [5, 1, 0]);
            socket.write_all(&[5]).unwrap();
            socket.write_all(&[0]).unwrap();
            let mut prefix = [0; 5];
            socket.read_exact(&mut prefix).unwrap();
            assert_eq!(&prefix[..4], &[5, 1, 0, 3]);
            let mut name = vec![0; prefix[4] as usize];
            socket.read_exact(&mut name).unwrap();
            assert_eq!(name, b"unresolved.example");
            let mut port = [0; 2];
            socket.read_exact(&mut port).unwrap();
            assert_eq!(u16::from_be_bytes(port), 443);
            for byte in [5, 0, 0, 1, 127, 0, 0, 1, 0, 0] {
                socket.write_all(&[byte]).unwrap();
            }
            socket.write_all(b"TLS").unwrap();
        });
        let mut tunnel = connect(
            ProxyEndpoint::Socks5(address),
            "unresolved.example:443",
            Instant::now() + Duration::from_secs(2),
            &AtomicBool::new(false),
        )
        .unwrap();
        let mut payload = [0; 3];
        tunnel.read_exact(&mut payload).unwrap();
        assert_eq!(&payload, b"TLS");
        server.join().unwrap();
    }
    #[test]
    fn stalled_negotiation_obeys_the_task_deadline() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut bytes = [0; 3];
            socket.read_exact(&mut bytes).unwrap();
            let mut end = [0];
            let _ = socket.read(&mut end);
        });
        let start = Instant::now();
        assert!(connect(
            ProxyEndpoint::Socks5(address),
            "unresolved.example:443",
            start + Duration::from_millis(80),
            &AtomicBool::new(false)
        )
        .is_err());
        assert!(start.elapsed() < Duration::from_millis(500));
        server.join().unwrap();
    }
    #[test]
    fn unsupported_authentication_fails_without_sending_a_destination() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut greeting = [0; 3];
            stream.read_exact(&mut greeting).unwrap();
            stream.write_all(&[5, 2]).unwrap();
            assert_eq!(stream.read(&mut [0]).unwrap(), 0);
        });
        let error = connect(
            ProxyEndpoint::Socks5(address),
            "unresolved.example:443",
            Instant::now() + Duration::from_secs(2),
            &AtomicBool::new(false),
        )
        .unwrap_err();
        server.join().unwrap();
        assert!(error.contains("authentication"));
    }
    #[test]
    fn cancellation_never_connects_to_the_proxy() {
        assert!(connect(
            ProxyEndpoint::Socks5("127.0.0.1:1".parse().unwrap()),
            "unresolved.example:443",
            Instant::now() + Duration::from_secs(2),
            &AtomicBool::new(true)
        )
        .is_err());
    }
}
