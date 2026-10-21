// On-demand native storage adapter. No desktop window, browser or AI host.
// Relocation has exactly one implementation, shared with the desktop command.
#[allow(dead_code)]
#[path = "../library_location.rs"]
mod library_location;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io::{self, Read},
    path::Path,
};

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "lowercase", deny_unknown_fields)]
enum Request {
    Choose { title: String },
    Pickfiles { title: String },
    Move { source: String, target: String },
}
fn run(request: Request) -> Result<Value, String> {
    match request {
        Request::Choose { title } => {
            if title.len() > 200 {
                return Err("The dialog title is too long.".into());
            }
            let path = rfd::FileDialog::new().set_title(title).pick_folder();
            Ok(json!({ "path": path.map(|path| library_location::display_path(&path)) }))
        }
        // The plugin's import picker. Paths stay on this computer; the App only
        // receives short-lived tokens from the MCP server.
        Request::Pickfiles { title } => {
            if title.len() > 200 {
                return Err("The dialog title is too long.".into());
            }
            let paths = rfd::FileDialog::new().set_title(title).pick_files().unwrap_or_default();
            Ok(json!({ "paths": paths.iter().map(|path| path.to_string_lossy()).collect::<Vec<_>>() }))
        }
        Request::Move { source, target } => {
            if source.len() > 32768
                || target.len() > 32768
                || !Path::new(&source).is_absolute()
                || !Path::new(&target).is_absolute()
            {
                return Err("Choose an absolute folder path.".into());
            }
            let current = library_location::resolve(Path::new(&source))?;
            if !current.join("stashdock.sqlite3").is_file() {
                return Err("The library is unavailable.".into());
            }
            let root = library_location::relocate(&current, Path::new(&target))?;
            Ok(json!({"path":library_location::display_path(&root)}))
        }
    }
}
fn main() {
    let result = (|| {
        let mut bytes = Vec::new();
        io::stdin()
            .take(70001)
            .read_to_end(&mut bytes)
            .map_err(|_| "Storage request could not be read.".to_string())?;
        if bytes.len() > 70000 {
            return Err("Storage request is too large.".into());
        }
        let request =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid storage request.".to_string())?;
        run(request)
    })();
    println!(
        "{}",
        match result {
            Ok(value) => value,
            Err(error) => json!({"error":error}),
        }
    );
}
