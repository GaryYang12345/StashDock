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
 assert.match(coordinator,/if let Err\(error\)\s*=\s*result/);assert.match(coordinator,/\.requested\s*=\s*old/);
 assert.match(coordinator,/if requested\s*==\s*visible/);
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
