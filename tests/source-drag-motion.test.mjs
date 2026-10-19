import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('native reveal never applies a second DOM entrance or remounts the shelf', async () => {
  const renderer = await read('src/components/DesktopWindows.tsx');
  assert.doesNotMatch(renderer, /createSurfaceHandoffMotion|desktop-window-transition|finish_desktop_transition|\.animate\(|style\.transform|style\.width|style\.height/);
  assert.match(renderer, /renderLibrary\(/);
  assert.match(renderer, /setStatus\(await switchDesktopSurface\(next\)\)/);
  assert.doesNotMatch(renderer, /set_desktop_motion|transitionId|matchMedia|inert=/);
});

test('surface switching uses direct native visibility without custom animation machinery', async () => {
  const native = await read('src-tauri/src/desktop_windows.rs');
  const entry = await read('src-tauri/src/lib.rs');
  assert.match(native, /window\.show\(\)/);
  assert.match(native, /window_frame::hide_immediately\(&window\)/);
  const apply = native.slice(native.indexOf('fn apply('), native.indexOf('fn prepare_placement('));
  assert.ok(apply.indexOf('hide_immediately(&outgoing)') < apply.indexOf('window.unminimize()'));
  assert.ok(apply.indexOf('hide_immediately(&outgoing)') < apply.indexOf('window.show()'));
  assert.match(apply, /if let Err\(error\) = result[\s\S]*window\.show\(\)/);
  assert.doesNotMatch(native + entry, /visual_handoff|DwmRegisterThumbnail|Presentation|Travel|set_desktop_motion|desktop_motion_diagnostics|transition_id/);
  assert.doesNotMatch(native, /thread::sleep|from_millis/);
  // The entry point has a bounded cold-start state gate. Its worker-thread
  // readiness wait is not window motion and must not leak into switching.
  const startup = entry.slice(entry.indexOf('async fn desktop_runtime_ready('), entry.indexOf('async fn preview_link('));
  assert.match(startup, /spawn_blocking/);
  assert.match(startup, /from_secs\(30\)/);
  assert.doesNotMatch(entry.replace(startup, ''), /thread::sleep|from_millis/);
});

test('either outgoing surface hides synchronously through Tauri without an OS fade', async () => {
  const frame = await read('src-tauri/src/window_frame.rs');
  const hide = frame.slice(frame.indexOf('pub fn hide_immediately'), frame.indexOf('pub fn client_frame_size'));
  assert.match(hide, /DWMWA_TRANSITIONS_FORCEDISABLED/);
  assert.match(hide, /let disabled: i32 = 1/);
  assert.match(hide, /window\.hide\(\)\.map_err/);
  assert.doesNotMatch(hide, /ShowWindow\(hwnd|\bSW_HIDE\b/);
  assert.match(hide, /IsWindowVisible\(hwnd\)/);
  assert.doesNotMatch(hide, /sleep|spawn|SetWindowPos|DwmRegisterThumbnail/);
});

test('folder is the monitor/placement anchor, with no delayed completions', async () => {
  const native = await read('src-tauri/src/desktop_windows.rs');
  assert.match(native, /window_geometry::anchored_panel/);
  assert.match(native, /let half = window_geometry::FOLDER_SIZE \/ 2\.0/);
  assert.match(native, /old == Some\(Surface::Folder\) && next == Surface::Panel/);
  assert.match(native, /set_always_on_top\(next == Surface::Folder\)/);
  assert.doesNotMatch(native, /desktop-window-transition|from_millis|finish_desktop_transition/);
});

test('Shell still owns translucent dragging, independently of window presentation', async () => {
  const drag = await read('src-tauri/src/reference_drag_windows.rs');
  assert.match(drag, /helper.InitializeFromBitmap/);
  assert.doesNotMatch(drag, /OpaqueDragPreview|follow_cursor|CreateWindow|SetWindowPos/);
  const client = await read('src/lib/reference-drag.ts');
  assert.doesNotMatch(client, /snapshotDragSource|preparedDragSource|toCanvas|html-to-image|fetch\(/);
  assert.match(client, /if \(selectionBar\(source\)\) return selectionBarPreview\(source\)/);
});
