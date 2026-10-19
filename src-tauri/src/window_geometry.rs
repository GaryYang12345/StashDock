//! Persisted physical positions and logical sizes. No content or library data.
use serde::{Deserialize, Serialize};
pub const PANEL_MIN_WIDTH: f64 = 560.0;
pub const PANEL_MIN_HEIGHT: f64 = 640.0;
pub const FOLDER_SIZE: f64 = 144.0;
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Geometry {
    pub x: i32,
    pub y: i32,
    pub width: f64,
    pub height: f64,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct SavedWindows {
    pub panel: Option<Geometry>,
    pub folder: Option<Geometry>,
}
#[derive(Clone, Copy)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}
pub fn fits(geometry: Geometry) -> bool {
    geometry.x.unsigned_abs() <= 1_000_000
        && geometry.y.unsigned_abs() <= 1_000_000
        && geometry.width.is_finite()
        && geometry.height.is_finite()
        && geometry.width > 0.0
        && geometry.height > 0.0
        && geometry.width <= 10000.0
        && geometry.height <= 10000.0
}
pub fn clamp(saved: Option<Geometry>, area: WorkArea, folder: bool) -> Geometry {
    let margin = 16.0;
    let available_w = (area.width as f64 / area.scale - margin * 2.0).max(FOLDER_SIZE);
    let available_h = (area.height as f64 / area.scale - margin * 2.0).max(FOLDER_SIZE);
    let saved = saved.filter(|value| fits(*value)).map(|mut g| {
        if folder && g.width == 160.0 && g.height == 232.0 {
            // One-time migration from the retired tooltip canvas, preserving
            // the artwork centre at the monitor's actual DPI.
            g.x += (8.0 * area.scale).round() as i32;
            g.y += (80.0 * area.scale).round() as i32;
            g.width = FOLDER_SIZE;
            g.height = FOLDER_SIZE;
        }
        g
    });
    let (w, h) = if folder {
        (FOLDER_SIZE, FOLDER_SIZE)
    } else {
        let value = saved.unwrap_or(Geometry {
            x: 0,
            y: 0,
            width: 1180.0,
            height: 760.0,
        });
        (
            value.width.max(PANEL_MIN_WIDTH).min(available_w),
            value.height.max(PANEL_MIN_HEIGHT).min(available_h),
        )
    };
    let width = (w * area.scale).ceil() as i32;
    let height = (h * area.scale).ceil() as i32;
    let pad = (margin * area.scale).round() as i32;
    let right = area.x + area.width as i32;
    let bottom = area.y + area.height as i32;
    let default_x = if folder {
        right - width - pad
    } else {
        area.x + (area.width as i32 - width) / 2
    };
    let default_y = if folder {
        bottom - height - pad
    } else {
        area.y + (area.height as i32 - height) / 2
    };
    Geometry {
        x: saved
            .map_or(default_x, |v| v.x)
            .clamp(area.x, (right - width).max(area.x)),
        y: saved
            .map_or(default_y, |v| v.y)
            .clamp(area.y, (bottom - height).max(area.y)),
        width: w,
        height: h,
    }
}
/// Folder-centred reveal, with one edge clamp before the first visible frame.
/// Positions/anchor/frame gutters are physical; persisted sizes are logical.
pub fn anchored_panel(
    saved: Option<Geometry>,
    area: WorkArea,
    center: (f64, f64),
    gutters: (f64, f64),
) -> Geometry {
    let mut g = clamp(saved, area, false);
    let pad = (16.0 * area.scale).round();
    let available_w = (area.width as f64 - pad * 2.0 - gutters.0).max(1.0);
    let available_h = (area.height as f64 - pad * 2.0 - gutters.1).max(1.0);
    g.width = g.width.min(available_w / area.scale);
    g.height = g.height.min(available_h / area.scale);
    let w = g.width * area.scale + gutters.0;
    let h = g.height * area.scale + gutters.1;
    let left = area.x as f64 + pad;
    let top = area.y as f64 + pad;
    g.x = (center.0 - w / 2.0)
        .clamp(
            left,
            (area.x as f64 + area.width as f64 - pad - w).max(left),
        )
        .round() as i32;
    g.y = (center.1 - h / 2.0)
        .clamp(top, (area.y as f64 + area.height as f64 - pad - h).max(top))
        .round() as i32;
    g
}
/// Collapse the dashboard into the folder at the dashboard's current centre.
/// Native bounds match the artwork, with no retired hint spacer.
pub fn anchored_folder(area: WorkArea, center: (f64, f64)) -> Geometry {
    let half = FOLDER_SIZE / 2.0;
    clamp(
        Some(Geometry {
            x: (center.0 - half * area.scale).round() as i32,
            y: (center.1 - half * area.scale).round() as i32,
            width: FOLDER_SIZE,
            height: FOLDER_SIZE,
        }),
        area,
        true,
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn smaller_folder_matches_config_and_upgrades_the_retired_hint_canvas() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(
            config["app"]["windows"][1]["width"].as_f64(),
            Some(FOLDER_SIZE)
        );
        assert_eq!(
            config["app"]["windows"][1]["height"].as_f64(),
            Some(FOLDER_SIZE)
        );
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let area = WorkArea {
                x: 0,
                y: 0,
                width: 3840,
                height: 2160,
                scale,
            };
            let old = Geometry {
                x: 300,
                y: 200,
                width: 160.0,
                height: 232.0,
            };
            let new = clamp(Some(old), area, true);
            assert!(
                (new.x as f64 + FOLDER_SIZE / 2.0 * scale - (300.0 + 80.0 * scale)).abs() <= 0.5
            );
            assert!(
                (new.y as f64 + FOLDER_SIZE / 2.0 * scale - (200.0 + 152.0 * scale)).abs() <= 0.5
            );
            let again = clamp(Some(new), area, true);
            assert_eq!((new.x, new.y), (again.x, again.y));
        }
    }
    #[test]
    fn panel_minimum_preserves_content_space_and_yields_to_small_work_areas() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(
            config["app"]["windows"][0]["minWidth"].as_f64(),
            Some(PANEL_MIN_WIDTH)
        );
        assert_eq!(
            config["app"]["windows"][0]["minHeight"].as_f64(),
            Some(PANEL_MIN_HEIGHT)
        );
        let old = Some(Geometry {
            x: 0,
            y: 0,
            width: 390.0,
            height: 420.0,
        });
        let normal = clamp(
            old,
            WorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                scale: 1.0,
            },
            false,
        );
        assert_eq!(
            (normal.width, normal.height),
            (PANEL_MIN_WIDTH, PANEL_MIN_HEIGHT)
        );
        let small = clamp(
            old,
            WorkArea {
                x: -400,
                y: -300,
                width: 500,
                height: 550,
                scale: 1.5,
            },
            false,
        );
        assert!(small.width * 1.5 <= 500.0);
        assert!(small.height * 1.5 <= 550.0);
    }
    #[test]
    fn panel_follows_the_folder_not_its_saved_location_and_clamps_once() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let area = WorkArea {
                x: -2400,
                y: -500,
                width: 2400,
                height: 1500,
                scale,
            };
            let saved = Some(Geometry {
                x: 9000,
                y: 9000,
                width: 800.0,
                height: 600.0,
            });
            let gutters = (15.0, 9.0);
            let center = (-1200.0, 250.0);
            let g = anchored_panel(saved, area, center, gutters);
            assert!((g.x as f64 + (g.width * scale + gutters.0) / 2.0 - center.0).abs() <= 0.5);
            assert!((g.y as f64 + (g.height * scale + gutters.1) / 2.0 - center.1).abs() <= 0.5);
            for anchor in [(-2390.0, -490.0), (-5.0, 990.0)] {
                let edge = anchored_panel(saved, area, anchor, gutters);
                assert!(edge.x >= area.x && edge.y >= area.y);
                assert!(
                    edge.x as f64 + edge.width * scale + gutters.0
                        <= area.x as f64 + area.width as f64
                );
                assert!(
                    edge.y as f64 + edge.height * scale + gutters.1
                        <= area.y as f64 + area.height as f64
                );
            }
        }
    }
    #[test]
    fn bounds_follow_dpi_and_disconnected_negative_monitors() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let area = WorkArea {
                x: -1920,
                y: -400,
                width: 1920,
                height: 1080,
                scale,
            };
            let g = clamp(
                Some(Geometry {
                    x: 10000,
                    y: -10000,
                    width: 9000.0,
                    height: 9000.0,
                }),
                area,
                false,
            );
            assert!(g.x >= area.x && g.y >= area.y);
            assert!(g.x as f64 + g.width * scale <= (area.x + area.width as i32) as f64 + 1.0);
            assert!(g.y as f64 + g.height * scale <= (area.y + area.height as i32) as f64 + 1.0);
        }
    }
    #[test]
    fn invalid_saved_sizes_do_not_prevent_startup() {
        let area = WorkArea {
            x: 0,
            y: 0,
            width: 1280,
            height: 720,
            scale: 1.5,
        };
        let g = clamp(
            Some(Geometry {
                x: 0,
                y: 0,
                width: f64::NAN,
                height: 10.0,
            }),
            area,
            false,
        );
        assert!(g.width.is_finite());
        assert!(g.height <= 720.0 / 1.5);
        let folder = clamp(None, area, true);
        assert_eq!((folder.width, folder.height), (FOLDER_SIZE, FOLDER_SIZE));
    }
    #[test]
    fn folder_collapses_to_the_panel_centre_and_clamps_at_edges() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let area = WorkArea {
                x: -1920,
                y: -300,
                width: 1920,
                height: 1080,
                scale,
            };
            let center = (-980.0, 240.0);
            let g = anchored_folder(area, center);
            assert!((g.x as f64 + FOLDER_SIZE / 2.0 * scale - center.0).abs() <= 0.5);
            assert!((g.y as f64 + FOLDER_SIZE / 2.0 * scale - center.1).abs() <= 0.5);
            for edge in [(-1919.0, -299.0), (-1.0, 779.0)] {
                let edge_g = anchored_folder(area, edge);
                assert!(edge_g.x >= area.x && edge_g.y >= area.y);
                assert!(
                    edge_g.x as f64 + FOLDER_SIZE * scale
                        <= (area.x + area.width as i32) as f64 + 1.0
                );
                assert!(
                    edge_g.y as f64 + FOLDER_SIZE * scale
                        <= (area.y + area.height as i32) as f64 + 1.0
                );
            }
        }
    }
}
