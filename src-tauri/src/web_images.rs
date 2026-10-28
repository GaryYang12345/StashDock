use base64::{engine::general_purpose::STANDARD, Engine};
use image::{imageops::FilterType, ImageReader};
use std::{io::Cursor, time::Instant};

// Rasterize/decode before saving: never retain HTML, SVG scripts or enormous bitmaps.
pub fn raster(bytes: &[u8], icon: bool) -> Result<String, String> {
    raster_with_background(bytes, icon, false)
}
/// Custom covers are opaque thumbnails; composite transparency instead of
/// discarding alpha (which makes black transparent artwork disappear).
pub fn cover(bytes: &[u8]) -> Result<String, String> {
    raster_with_background(bytes, false, true)
}
/// Shared local/MCP decoder. No browser, URL, file path or library access.
pub fn cover_base64(value: &str) -> Result<String, String> {
    if value.is_empty() || value.len() > 6_666_668 {
        return Err("Choose an image under 5 MB.".into());
    }
    let bytes = STANDARD
        .decode(value)
        .map_err(|_| "The cover image data is invalid.")?;
    if STANDARD.encode(&bytes) != value {
        return Err("The cover image data is invalid.".into());
    }
    cover(&bytes)
}
/// Small in-process native covers obey the same decoder limits as web covers.
#[cfg(target_os = "macos")]
pub(crate) fn native_thumbnail(bytes: &[u8]) -> Result<String, String> {
    let image = decode_raster(bytes)?;
    // CSS cover: fill the 214x106 search cover, centred horizontally and
    // anchored to its top. Crop before shrinking so tall originals stay sharp.
    let ratio = 214.0 / 106.0;
    let width = image
        .width()
        .min((image.height() as f64 * ratio).round() as u32)
        .max(1);
    let height = image
        .height()
        .min((image.width() as f64 / ratio).round() as u32)
        .max(1);
    let image = image
        .crop_imm((image.width() - width) / 2, 0, width, height)
        .resize_exact(428, 212, FilterType::Lanczos3);
    let mut output = Vec::new();
    if image.color().has_alpha() {
        image
            .write_to(&mut Cursor::new(&mut output), image::ImageFormat::Png)
            .map_err(|_| "Unsupported image.".to_string())?;
        return Ok(format!("data:image/png;base64,{}", STANDARD.encode(output)));
    }
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 80)
        .encode_image(&image.to_rgb8())
        .map_err(|_| "Unsupported image.".to_string())?;
    Ok(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(output)
    ))
}
fn decode_raster(bytes: &[u8]) -> Result<image::DynamicImage, String> {
    if bytes.len() > 5_000_000 {
        return Err("Image is too large.".into());
    }
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "Unsupported image.")?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(64 * 1024 * 1024);
    reader.limits(limits);
    reader
        .decode()
        .map_err(|_| "Unsupported or oversized image.".into())
}
fn raster_with_background(bytes: &[u8], icon: bool, flatten: bool) -> Result<String, String> {
    if bytes.len() > 5_000_000 {
        return Err("Image is too large.".into());
    }
    if icon && std::str::from_utf8(bytes).is_ok_and(|text| text.contains("<svg")) {
        return svg_icon(bytes);
    }
    let decoded = decode_raster(bytes)?;
    let mut image = if icon {
        decoded.resize(32, 32, FilterType::Triangle)
    } else {
        decoded.resize(960, 600, FilterType::Triangle)
    };
    if flatten && image.color().has_alpha() {
        let rgba = image.to_rgba8();
        let mut rgb = image::RgbImage::new(image.width(), image.height());
        for (source, target) in rgba.pixels().zip(rgb.pixels_mut()) {
            let alpha = u32::from(source[3]);
            for channel in 0..3 {
                target[channel] =
                    ((u32::from(source[channel]) * alpha + 255 * (255 - alpha) + 127) / 255) as u8;
            }
        }
        image = image::DynamicImage::ImageRgb8(rgb);
    }
    let mut output = Vec::new();
    let mime = if icon {
        image
            .write_to(&mut Cursor::new(&mut output), image::ImageFormat::Png)
            .map_err(|_| "Image could not be saved.")?;
        "png"
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 78)
            .encode_image(&image.to_rgb8())
            .map_err(|_| "Image could not be saved.")?;
        "jpeg"
    };
    let data = format!("data:image/{mime};base64,{}", STANDARD.encode(output));
    if data.len() > if icon { 32768 } else { 750_000 } {
        return Err("Preview is too large.".into());
    }
    Ok(data)
}
fn svg_icon(bytes: &[u8]) -> Result<String, String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "Invalid SVG icon.")?;
    let lower = text.to_ascii_lowercase();
    if bytes.len() > 65536
        || text.matches('<').count() > 2048
        || ["<!doctype", "<!entity", "<filter", "<use", "<foreignobject"]
            .iter()
            .any(|value| lower.contains(value))
    {
        return Err("Complex SVG icons are not supported.".into());
    }
    // usvg's default resolver reads local files. Explicitly disable BOTH href
    // resolvers, including nested data images. No fonts or script execution.
    let mut options = resvg::usvg::Options::default();
    options.image_href_resolver.resolve_string = Box::new(|_, _| None);
    options.image_href_resolver.resolve_data = Box::new(|_, _, _| None);
    let tree = resvg::usvg::Tree::from_str(text, &options).map_err(|_| "Invalid SVG icon.")?;
    if tree.size().width() > 4096.0 || tree.size().height() > 4096.0 {
        return Err("SVG icon is too large.".into());
    }
    let scale = (32.0 / tree.size().width()).min(32.0 / tree.size().height());
    let mut pixmap =
        resvg::tiny_skia::Pixmap::new(32, 32).ok_or("SVG icon could not be rendered.")?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    if !pixmap.data().chunks_exact(4).any(|pixel| pixel[3] != 0) {
        return Err("SVG icon has no visible artwork.".into());
    }
    let png = pixmap
        .encode_png()
        .map_err(|_| "SVG icon could not be saved.")?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(png)))
}
pub fn download(value: &str, icon: bool, deadline: Instant) -> Result<String, String> {
    let response = crate::public_web::fetch(
        value,
        if icon { 512_000 } else { 5_000_000 },
        "image/*",
        deadline,
    )?;
    raster(&response.bytes, icon)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(target_os = "macos")]
    #[test]
    fn native_cover_matches_top_crop_and_preserves_transparent_pixels() {
        let mut image = image::RgbaImage::from_pixel(214, 600, image::Rgba([0, 0, 255, 255]));
        for y in 0..106 {
            for x in 0..214 {
                image.put_pixel(x, y, image::Rgba([255, 0, 0, 255]));
            }
        }
        for y in 0..30 {
            for x in 0..30 {
                image.put_pixel(x, y, image::Rgba([0, 0, 0, 0]));
            }
        }
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgba8(image)
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .unwrap();
        let thumbnail = native_thumbnail(&bytes).unwrap();
        let output = image::load_from_memory(
            &STANDARD
                .decode(thumbnail.split_once(',').unwrap().1)
                .unwrap(),
        )
        .unwrap()
        .to_rgba8();
        assert_eq!(output.dimensions(), (428, 212));
        assert_eq!(output.get_pixel(10, 10).0[3], 0);
        assert_eq!(output.get_pixel(214, 106).0, [255, 0, 0, 255]);
        assert_eq!(output.get_pixel(214, 210).0, [255, 0, 0, 255]);
    }
    #[test]
    fn rejects_html_and_normalizes_image_bytes_with_bounded_dimensions() {
        assert!(raster(b"<html>not an icon</html>", true).is_err());
        let image = image::DynamicImage::new_rgba8(100, 80);
        let mut bytes = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .unwrap();
        let data = raster(&bytes, true).unwrap();
        let output = STANDARD.decode(data.split_once(',').unwrap().1).unwrap();
        let decoded = image::load_from_memory(&output).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (32, 26));
        assert!(raster(&bytes, false)
            .unwrap()
            .starts_with("data:image/jpeg;base64,"));
    }
    #[test]
    fn svg_icons_become_inert_png_without_any_external_image_resolver() {
        let data = raster(br#"<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/><image href="file:///secret.png" width="32" height="32"/></svg>"#, true).unwrap();
        let bytes = STANDARD.decode(data.split_once(',').unwrap().1).unwrap();
        let image = image::load_from_memory(&bytes).unwrap().to_rgba8();
        assert_eq!(image.get_pixel(16, 16).0, [255, 0, 0, 255]);
        assert!(raster(
            br#"<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>"#,
            true
        )
        .is_err());
    }

    #[test]
    fn custom_cover_flattens_alpha_but_retains_visible_black_artwork() {
        let mut rgba = image::RgbaImage::new(80, 50);
        for y in 10..40 {
            for x in 20..60 {
                rgba.put_pixel(x, y, image::Rgba([0, 0, 0, 255]));
            }
        }
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgba8(rgba)
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .unwrap();
        let output = cover(&bytes).unwrap();
        let output =
            image::load_from_memory(&STANDARD.decode(output.split_once(',').unwrap().1).unwrap())
                .unwrap()
                .to_rgb8();
        assert!(output
            .get_pixel(0, 0)
            .0
            .iter()
            .all(|channel| *channel > 245));
        assert!(output
            .get_pixel(output.width() / 2, output.height() / 2)
            .0
            .iter()
            .all(|channel| *channel < 10));
    }
}
