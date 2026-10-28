// A browser-owned, one-request process. Never starts Tauri, a WebView or MCP.
fn main() {
    if let Err(error) = stashdock_lib::run_browser_native_host() {
        eprintln!("StashDock browser host: {error}");
        std::process::exit(1);
    }
}
