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
  assert.match(native, /window_frame::show_immediately\(&window\)/);
  assert.match(native, /window_frame::hide_immediately\(window\)/);
  const apply = native.slice(native.indexOf('fn apply('), native.indexOf('fn prepare_placement('));
  assert.match(apply, /let reveal_first = old == Some\(Surface::Panel\) && next == Surface::Folder/);
  assert.match(apply, /if old != target && !reveal_first/);
  assert.ok(apply.indexOf('show_immediately(&window)?') < apply.indexOf('for surface in [Surface::Panel, Surface::Folder]'));
  assert.match(apply, /if let Err\(error\) = result[\s\S]*show_immediately\(&window\)/);
  assert.doesNotMatch(native + entry, /visual_handoff|DwmRegisterThumbnail|Presentation|Travel|set_desktop_motion|desktop_motion_diagnostics|transition_id/);
  assert.doesNotMatch(native, /thread::sleep|from_millis/);
  // The entry point has a bounded cold-start state gate. Its worker-thread
  // readiness wait is not window motion and must not leak into switching.
  const startup = entry.slice(entry.indexOf('async fn desktop_runtime_ready('), entry.indexOf('async fn preview_link('));
  assert.match(startup, /spawn_blocking/);
  assert.match(startup, /from_secs\(30\)/);
  assert.doesNotMatch(entry.replace(startup, ''), /thread::sleep|from_millis/);
});

test('both reveals and hides disable OS fades before framework visibility changes', async () => {
  const frame = await read('src-tauri/src/window_frame.rs');
  const policy = frame.slice(frame.indexOf('fn disable_transitions'), frame.indexOf('pub fn show_immediately'));
  assert.match(policy, /DWMWA_TRANSITIONS_FORCEDISABLED/);
  assert.match(policy, /fn disable_transitions[\s\S]*set_transitions\(window, false\)/);
  assert.match(policy, /let disabled: i32 = i32::from\(!enabled\)/);
  const show = frame.slice(frame.indexOf('pub fn show_immediately'), frame.indexOf('pub fn hide_immediately'));
  assert.ok(show.indexOf('disable_transitions(window)?') < show.indexOf('window.show()'));
  const hide = frame.slice(frame.indexOf('pub fn hide_immediately'), frame.indexOf('pub fn client_frame_size'));
  assert.ok(hide.indexOf('disable_transitions(window)?') < hide.indexOf('window.hide()'));
  assert.match(hide, /window\.hide\(\)\.map_err/);
  assert.doesNotMatch(hide, /ShowWindow\(hwnd|\bSW_HIDE\b/);
  assert.match(hide, /IsWindowVisible\(hwnd\)/);
  assert.doesNotMatch(hide, /sleep|spawn|SetWindowPos|DwmRegisterThumbnail/);
});

test('the panel leaves and returns with Windows own minimize/restore animation only', async () => {
  const native = await read('src-tauri/src/desktop_windows.rs');
  const frame = await read('src-tauri/src/window_frame.rs');
  const conceal = native.slice(native.indexOf('fn conceal('), native.indexOf('fn apply('));
  assert.match(conceal, /window_frame::minimize_animated\(window\)/);
  const animated = frame.slice(frame.indexOf('pub fn minimize_animated'), frame.indexOf('pub fn minimize_immediately'));
  assert.ok(animated.indexOf('set_transitions(window, true)?') < animated.indexOf('window.minimize()'));
  const restoring = frame.slice(frame.indexOf('pub fn reveal_restoring'), frame.indexOf('impl Drop for PreparedRestore'));
  // Re-minimized while still cloaked, then restored visibly with transitions on.
  const order = ['disable_transitions(&self.window)?', 'self.window.minimize()', 'set_cloaked(&self.window, false)?', 'set_transitions(&self.window, true)?', 'self.window.unminimize()'];
  order.reduce((last, step) => { const at = restoring.indexOf(step); assert.ok(at > last, step); return at; }, -1);
  const apply = native.slice(native.indexOf('fn apply('), native.indexOf('fn prepare_placement('));
  assert.match(apply, /old == Some\(Surface::Folder\) && target == Some\(Surface::Panel\)[\s\S]*restore\.reveal_restoring\(\)\?/);
  assert.doesNotMatch(native + frame, /DwmRegisterThumbnail|UpdateLayeredWindow|window_morph/);
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
