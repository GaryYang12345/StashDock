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
/// The folder's quick search: a fixed transparent canvas beside the
/// folder (always above it, including near the screen's top edge). Only its
/// visible pieces take input, through a window region set by the search itself.
pub const SEARCH_WIDTH: f64 = 480.0;
pub const SEARCH_HEIGHT: f64 = 316.0;
/// The search field sits on the folder artwork's transparent top margin; the
/// window reaches a little further so the field's shadow is not cut off.
pub const SEARCH_OVERLAP: f64 = 40.0;
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPlacement {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// The folder's centre from the window's left edge, in physical pixels
    /// (the page divides by its own device pixel ratio).
    pub anchor_px: f64,
}
/// How far left of the folder's geometric centre the search axis sits (CSS px).
pub const SEARCH_OPTICAL_SHIFT: f64 = 4.0;
pub fn search_placement(folder: (i32, i32), folder_size: f64, area: WorkArea) -> SearchPlacement {
    search_placement_with_shift(folder, folder_size, area, SEARCH_OPTICAL_SHIFT)
}
/// The native Mac accessory shares the folder window's geometric centre. Keep
/// Windows' approved optical adjustment in its adapter, rather than adding a
/// compensating offset to individual native controls.
pub fn centred_search_placement(folder: (i32, i32), folder_size: f64, area: WorkArea) -> SearchPlacement {
    search_placement_with_shift(folder, folder_size, area, 0.0)
}
fn search_placement_with_shift(folder: (i32, i32), folder_size: f64, area: WorkArea, shift: f64) -> SearchPlacement {
    let scale = area.scale;
    let (w, h) = ((SEARCH_WIDTH * scale).round(), (SEARCH_HEIGHT * scale).round());
    let overlap = SEARCH_OVERLAP * scale;
    // The folder artwork's visual mass sits right of its geometric centre:
    // the field and cards share an axis nudged slightly left to look centred.
    let centre = folder.0 as f64 + folder_size / 2.0 - shift * scale;
    // Always centred on the folder's (optical) axis, even if the outer cards then reach
    // past the screen edge: symmetry matters more than showing every side card.
    let x = (centre - w / 2.0).round();
    // Always above the folder, the same composition everywhere: near the top of
    // the screen the cards may reach past the edge rather than flip below.
    let y = (folder.1 as f64 - h + overlap).round();
    SearchPlacement {
        x: x as i32,
        y: y as i32,
        width: w as u32,
        height: h as u32,
        anchor_px: centre - x,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_search_and_folder_have_one_axis_at_every_scale_and_edge() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let area = WorkArea { x: -1920, y: -1080, width: 3840, height: 2160, scale };
            let size = FOLDER_SIZE * scale;
            for position in [(-1920, -1080), (-1920, 300), (1600, 300)] {
                let placed = centred_search_placement(position, size, area);
                assert!((placed.x as f64 + placed.anchor_px - (position.0 as f64 + size / 2.0)).abs() < 0.00001);
                assert!((placed.anchor_px - placed.width as f64 / 2.0).abs() <= 0.5);
                assert!(placed.y < position.1);
                let win = search_placement(position, size, area);
                assert!((placed.x as f64 + placed.anchor_px - win.x as f64 - win.anchor_px - SEARCH_OPTICAL_SHIFT * scale).abs() < 0.00001);
            }
        }
    }
    #[test]
    fn search_is_centred_on_the_folder_and_always_above_it() {
        let area = WorkArea { x: 0, y: 0, width: 1920, height: 1040, scale: 1.5 };
        let folder = 144.0 * 1.5;
        // Room above: centred on the folder, overlapping its transparent top.
        let up = search_placement((900, 700), folder, area);
        assert_eq!((up.width, up.height), (720, 474));
        assert_eq!(up.y, 700 - 474 + 60);
        assert_eq!(up.x, 900 + 108 - 6 - 360);
        assert!((up.anchor_px - 360.0).abs() < 0.01);
        // Near the top of the screen: still above the folder, reaching past the edge.
        let top = search_placement((900, 40), folder, area);
        assert_eq!(top.y, 40 - 474 + 60);
        // Screen edge: still centred on the folder, reaching past the edge.
        let edge = search_placement((1920 - 216, 700), folder, area);
        assert_eq!(edge.x, 1920 - 108 - 6 - 360);
        assert!((edge.anchor_px - 360.0).abs() < 0.01);
        // Negative monitor coordinates.
        let left = WorkArea { x: -1920, y: 0, width: 1920, height: 1040, scale: 1.0 };
        let placed = search_placement((-1920, 500), 144.0, left);
        assert_eq!(placed.x, -1920 + 72 - 4 - 240);
        assert!((placed.anchor_px - 240.0).abs() < 0.01);
    }

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
