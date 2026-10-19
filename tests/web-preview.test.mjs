import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('desktop image updates refresh the shared store without auto-saving snapshots', async () => {
  const hook = await readFile('src/features/library/useLibrary.ts', 'utf8');
  assert.match(hook, /reference-preview-updated/);
  assert.match(hook, /void libraryStore\.invalidate\(\)/);
  assert.match(hook, /await saveItems\(isTauri\(\) \? items : next\)/);
  assert.match(hook, /return isTauri\(\) \? loadItems\(\) : next/);
});
test('native preview work never rewrites the AI body or disables Chromium isolation', async () => {
  const worker = await readFile('src-tauri/src/web_preview.rs', 'utf8');
  const browser = await readFile('src-tauri/src/preview_browser.rs', 'utf8');
  const system = await readFile('src-tauri/src/preview_webview.rs', 'utf8');
  assert.match(worker, /WHERE id=\?3 AND url=\?4/);
  assert.doesNotMatch(worker, /SET (?:title|content|context_override|tags_json|favorite)/);
  assert.match(worker, /ON DELETE CASCADE/);
  assert.match(system, /CoreWebView2EnvironmentOptions/);
  assert.match(system, /BrowserJob::assign/);
  assert.match(browser, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(system, /--proxy-bypass-list=<-loopback>/);
  assert.match(system, /add_DownloadStarting/);
  assert.match(system, /SetCancel\(true\)/);
  assert.doesNotMatch(browser, /Page\.setDownloadBehavior/);
  assert.doesNotMatch(browser + system, /--no-sandbox|--ignore-certificate-errors|--disable-web-security/);
});
