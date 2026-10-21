fn main() {
    // The resource compiler reads this outside Rust include_bytes!, so Cargo
    // needs an explicit dependency to avoid retaining a stale Shell icon.
    if std::env::var("CARGO_CFG_TARGET_OS").is_ok_and(|os| os == "windows") {
        println!("cargo:rerun-if-changed=icons/icon.ico");
    }
    tauri_build::build()
}
