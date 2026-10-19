// Read-only, aggregate-only comparison. Never prints bookmark URLs/titles.
import { createImportServices } from '../plugins/stashdock/server/import-services.mjs';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-worker.mjs';
const helper = 'D:/StashDock/plugins/stashdock/bin/win32-x64/stashdock-preview.exe';
const legacy = createImportServices();
const sources = await runPreviewHelper(helper, { browserOperation: 'sources' }, undefined, {maxOutput:40_000_000});
if (!Array.isArray(sources)) throw Error('Native sources were not read');
const results = [];
for (const source of sources) {
  const old = await legacy.bookmarks(source.id);
  const rows = await runPreviewHelper(helper, { browserOperation: 'bookmarks', sourceId:source.id }, undefined, {maxOutput:40_000_000});
  if (!Array.isArray(rows)) throw Error('Native bookmarks were not read');
  results.push({ browser:source.browser, bookmarks:rows.length, previousInline:old.filter(row => row.faviconUrl && row.faviconUrl.length<=32768).length, sharedInline:rows.filter(row => row.faviconUrl).length });
}
const icons = await runPreviewHelper(helper, {browserOperation:'icons',urls:['https://spektralab.app/','https://arxiv.org/']});
console.log(JSON.stringify({results,publicIconFallbackCount:Object.keys(icons).length},null,2));
