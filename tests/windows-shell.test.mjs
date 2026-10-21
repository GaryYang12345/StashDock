import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const native=await read('src-tauri/src/lib.rs');
const coordinator=await read('src-tauri/src/desktop_windows.rs');
const folder=await read('src-tauri/src/folder_window.rs');
test('opaque panel uses platform shadow and resizing; transparent folder is independent',async()=>{
 const config=JSON.parse(await read('src-tauri/tauri.conf.json'));
 const panel=config.app.windows.find(w=>w.label==='main'), small=config.app.windows.find(w=>w.label==='folder');
 assert.equal(panel.transparent,false);assert.equal(panel.shadow,true);assert.equal(panel.resizable,true);assert.equal(panel.alwaysOnTop,false);
 assert.equal(small.transparent,true);assert.equal(small.alwaysOnTop,true);assert.equal(small.skipTaskbar,true);
 assert.ok(panel.width<1600&&panel.height<1000);assert.equal(small.width,144);assert.equal(small.height,144);
 assert.doesNotMatch(native+coordinator,/window_shadow|NonRudeHWND|SetWindowRgn|initialize_floating_canvas/);
});
test('exact folder square needs no retired hint region or extra native window',()=>{
 assert.match(folder,/window.label\(\) == "folder"/);
 assert.doesNotMatch(folder,/SetWindowRgn|CreateRoundRectRgn|CreateRectRgn|CreateWindowEx|window_shadow|set_folder_hint/);
});
test('native lifecycle serializes handoffs on UI thread with readiness and failure recovery',()=>{
 assert.match(coordinator,/run_on_main_thread/);assert.match(coordinator,/if !ready/);
 assert.match(coordinator,/if let Err\(error\)\s*=\s*result/);assert.match(coordinator,/\.pending\s*=\s*None/);
 assert.match(coordinator,/inner\.status\(\)/);
 assert.match(coordinator,/if which == Surface::Panel && !already_ready/);
 assert.match(coordinator,/if resize && window.inner_size/);
 assert.match(coordinator,/if !ready \|\| !window.is_visible/);
 assert.match(native,/api.prevent_close/);assert.match(native,/desktop_windows::persist_now/);
 assert.doesNotMatch(native,/RunEvent::ExitRequested/);
});
test('all native hosts have window capabilities, no cross-host geometry writes',async()=>{
 const cap=JSON.parse(await read('src-tauri/capabilities/default.json'));
 assert.deepEqual(cap.windows,['main','folder']);
 const bridge=await read('src/lib/desktopWindows.ts');
 assert.match(bridge,/startDragging/);assert.match(bridge,/drag_folder_window/);
 assert.doesNotMatch(bridge,/setSize|setPosition|requestAnimationFrame|localStorage/);
});

test('folder collapse retains the real minimized panel and native taskbar restore reopens the shelf', async()=>{
 const apply=coordinator.slice(coordinator.indexOf('fn apply('),coordinator.indexOf('fn prepare_placement('));
 assert.match(coordinator,/which == Surface::Panel && matches!\(mode, Mode::Folder \| Mode::Minimized\)/);
 assert.match(coordinator,/window_frame::minimize_immediately\(window\)/);
 assert.ok(apply.indexOf('PreparedRestore::new(&window)')<apply.indexOf('prepare_placement(app)'));
 assert.ok(apply.indexOf('restore.reveal()?')>apply.indexOf('for surface in [Surface::Panel, Surface::Folder]'));
 const frame=await read('src-tauri/src/window_frame.rs');
 assert.match(frame,/DWMWA_CLOAK/);
 assert.match(frame,/impl Drop for PreparedRestore/);
 assert.match(coordinator,/policy::native_intent\(/);
 assert.match(coordinator,/policy::resolve\(/);
 assert.doesNotMatch(coordinator,/taskbar_restored|toggle_target/);
 const entries=coordinator.slice(coordinator.indexOf('pub fn show_last('),coordinator.indexOf('pub fn window_event('));
 assert.doesNotMatch(entries,/\.minimize\(|\.hide\(|\.show\(/);
 assert.match(coordinator,/panel_frame\.ok_or|\.panel_frame[\s\S]*\.ok_or/);
 assert.doesNotMatch(coordinator,/ITaskbarList|CreateWindowEx|set_skip_taskbar/);
});

test('runtime taskbar large icon reuses the framework-owned high-resolution window icon',async()=>{
 const frame=await read('src-tauri/src/window_frame.rs');
 const lifecycle=await read('src-tauri/src/lifecycle.rs');
 assert.match(frame,/SendMessageW\(hwnd, WM_GETICON, ICON_SMALL as usize, 0\)/);
 assert.match(frame,/SendMessageW\(hwnd, WM_SETICON, ICON_BIG as usize, icon\)/);
 assert.match(lifecycle,/window_frame::set_taskbar_icon\(&window\)/);
 assert.doesNotMatch(frame,/DestroyIcon\(/);
});
