import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(path, 'utf8');
test('both shelves share row grouping, stable height and the destructive action', () => {
  for (const path of ['src/features/library/LibraryView.tsx','src/features/mcp-app/McpShelf.tsx']) {
    const text=source(path); assert.match(text,/ReferenceList.module.css/); assert.match(text,/listStyles.list/); assert.match(text,/DestructiveButton/);
  }
  const css=source('src/components/StashCard.module.css');
  assert.match(css,/height: 84px/); assert.match(css,/-webkit-line-clamp: 1/);
  assert.match(source('src/components/ReferenceList.module.css'),/\.list::before/);
  assert.match(source('src/components/DestructiveButton.tsx'),/variant="danger"/);
  assert.match(source('src/components/DestructiveButton.module.css'),/--surface-muted: color-mix/);
});
test('draft lookup starts image work and both image paths remove the right scrollbar', () => {
  assert.match(source('src-tauri/src/link_metadata.rs'),/preview_cache::start\(value\)/);
  assert.match(source('src-tauri/src/web_preview.rs'),/preview_cache::capture/);
  assert.match(source('src-tauri/src/preview_webview.rs'),/--hide-scrollbars/);
  assert.equal((source('src-tauri/src/preview_browser.rs').match(/"width":1264/g)||[]).length,2);
  assert.match(source('plugins/stashdock/server/create-server.mjs'),/preview: previewService.lookup/);
  assert.match(source('plugins/stashdock/server/preview-worker.mjs'),/const data = await prior/);
});
test('cold startup opens the library and only the standalone executable is detached', () => {
  assert.match(source('src-tauri/src/desktop_windows.rs'),/requested:\s*Some\(Surface::Panel\)/);
  assert.match(source('src-tauri/src/main.rs'),/relaunch_if_needed/);
  assert.match(source('src-tauri/src/independent_startup.rs'),/PROC_THREAD_ATTRIBUTE_PARENT_PROCESS/);
  assert.doesNotMatch(source('src-tauri/src/bin/preview-helper.rs'),/relaunch_if_needed/);
  assert.doesNotMatch(source('src-tauri/src/bin/preview-helper.rs'),/connector::|worker_if_requested/);
  assert.match(source('src-tauri/src/preview_browser.rs'),/JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
});
