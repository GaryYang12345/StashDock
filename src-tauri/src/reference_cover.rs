use base64::{engine::general_purpose::STANDARD, Engine};

fn decode(base64: &str, limit: usize) -> Result<Vec<u8>, String> {
    if base64.len() > limit {
        return Err("Choose an image under 5 MB.".into());
    }
    let bytes = STANDARD
        .decode(base64)
        .map_err(|_| "The cover image data is invalid.")?;
    if STANDARD.encode(&bytes) != base64 {
        return Err("The cover image data is invalid.".into());
    }
    Ok(bytes)
}

/// Revalidate optional file covers before any original-file writes. No paths or URLs accepted.
pub fn from_data_url(value: &str) -> Result<String, String> {
    let (prefix, base64) = value
        .split_once(',')
        .ok_or("The cover image data is invalid.")?;
    if value.len() > 750_000
        || !matches!(
            prefix,
            "data:image/jpeg;base64" | "data:image/png;base64" | "data:image/webp;base64"
        )
    {
        return Err("Use a prepared PNG, JPG or WebP cover image.".into());
    }
    crate::web_images::cover(&decode(base64, 750_000)?)
}

#[tauri::command]
pub async fn prepare_cover_image(base64: String) -> Result<String, String> {
    if base64.len() > 6_666_668 {
        return Err("Choose an image under 5 MB.".into());
    }
    tauri::async_runtime::spawn_blocking(move || crate::web_images::cover_base64(&base64))
        .await
        .map_err(|_| "The cover could not be prepared. Choose another image.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn covers_are_bounded_rasters_not_urls_scripts_or_arbitrary_data() {
        for value in [
            "https://example.org/image.png",
            "file:///private.png",
            "data:image/svg+xml;base64,PHN2Zy8+",
            "data:image/png;base64,aHRtbA==",
        ] {
            assert!(from_data_url(value).is_err());
        }
        assert!(decode(&"A".repeat(6_666_669), 6_666_668).is_err());
        let image = image::DynamicImage::new_rgb8(1200, 800);
        let mut bytes = Vec::new();
        image
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        let result =
            from_data_url(&format!("data:image/png;base64,{}", STANDARD.encode(bytes))).unwrap();
        let output =
            image::load_from_memory(&STANDARD.decode(result.split_once(',').unwrap().1).unwrap())
                .unwrap();
        assert!(output.width() <= 960 && output.height() <= 600 && result.len() <= 750_000);
    }
}
