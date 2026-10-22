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
  // Only rendered text may fill a body, and never user text, edited context or a settled import.
  assert.doesNotMatch(worker, /SET (?:context_override|tags_json|favorite)/);
  const text = worker.slice(worker.indexOf('fn merge_text'), worker.indexOf('fn finish(db'));
  assert.equal((worker.match(/SET content=/g) || []).length, 1);
  for (const guard of ['context_override IS NULL', "'$.contentEdited'),0)!=1", "'$.contentSettled'),0)!=1", "status='working'"]) assert.ok(text.includes(guard), guard);
  assert.match(worker, /ON DELETE CASCADE/);
  assert.match(system, /CoreWebView2EnvironmentOptions/);
  assert.match(system, /BrowserJob::assign/);
  assert.match(system, /own_environment\s*\.GetProcessInfos/);
  assert.match(system, /SetPriorityClass\(process, BELOW_NORMAL_PRIORITY_CLASS\)/);
  assert.doesNotMatch(system, /AssignProcessToJobObject\(job\.0, process\)/);
  assert.match(browser, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(system, /--proxy-bypass-list=<-loopback>/);
  assert.match(system, /add_DownloadStarting/);
  assert.match(system, /SetCancel\(true\)/);
  assert.doesNotMatch(browser, /Page\.setDownloadBehavior/);
  assert.doesNotMatch(browser + system, /--no-sandbox|--ignore-certificate-errors|--disable-web-security/);
});

test('live preview skeletons keep pulsing and still honor reduced motion', async () => {
  const css = await readFile('src/components/arc/skeleton/skeleton.module.css', 'utf8');
  assert.match(css, /animation: skeleton-pulse[^;]*infinite both/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*animation: none/s);
});

test('both background hosts use one image-only pipeline without retrying a failed screenshot inline', async () => {
  const worker = await readFile('src-tauri/src/web_preview.rs', 'utf8');
  const helper = await readFile('src-tauri/src/bin/preview-helper.rs', 'utf8');
  const browser = await readFile('src-tauri/src/preview_browser.rs', 'utf8');
  assert.match(worker, /crate::preview_enrichment::enrich/);
  assert.match(helper, /preview_enrichment::enrich/);
  assert.doesNotMatch(worker, /fetch_preview_with_images|preview_cache::capture/);
  assert.match(browser, /JOB_OBJECT_LIMIT_PRIORITY_CLASS/);
  assert.match(browser, /BELOW_NORMAL_PRIORITY_CLASS/);
});

test('slow screenshot pages retain their actual deadline and PDF context remains lightweight', async () => {
  const browser = await readFile('src-tauri/src/preview_browser.rs', 'utf8');
  const metadata = await readFile('src-tauri/src/link_metadata.rs', 'utf8');
  const content = metadata.slice(metadata.indexOf('pub fn fetch_content'), metadata.indexOf('pub fn fetch_preview_with_images'));
  assert.doesNotMatch(browser, /age >= Duration::from_secs\(10\)/);
  assert.match(browser, /while Instant::now\(\) < deadline && !stop.load/);
  assert.match(content, /fetch_context_document/);
  assert.doesNotMatch(content, /read_pdf/);
  assert.doesNotMatch(browser, /getTextContent|getMetadata|for \(let n=1; n<=pdf.numPages/);
  assert.match(browser, /render_pdf_cover/);
  const system = await readFile('src-tauri/src/preview_webview.rs', 'utf8');
  assert.match(system, /webview\.CapturePreview\(/);
  assert.match(system, /method == "StashDock.captureViewport"/);
  assert.doesNotMatch(browser, /Page\.captureScreenshot/);
  assert.match(system, /snapshot_data\(&snapshot\)/);
  assert.doesNotMatch(browser, /freeze = Some/);
  assert.match(content, /content: String::new\(\)/);
});
