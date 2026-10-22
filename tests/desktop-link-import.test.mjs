import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/linkImport.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { normalizeLink, makeLink, bookmarkCandidates, makeBrowserLinks, readImportDetails } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const source = { id: 'chrome:Default', browser: 'Chrome', profile: 'Personal' };

test('manual links normalize tracking and reject credentials and executable schemes', () => {
  assert.equal(normalizeLink(' example.org/post/?utm_source=mail#section '), 'https://example.org/post');
  for (const url of ['javascript:alert(1)', 'file:///private', 'https://user:password@example.org', 'not a link']) assert.throws(() => normalizeLink(url));
});
test('link content is saved as the real model body, not a bookmark placeholder', () => {
  const item = makeLink({ url: 'https://github.com/org/repo', title: 'My title', content: 'Full\n\ncontext', tags: ['Research'], faviconUrl: 'https://example.org/icon.png' });
  assert.equal(item.kind, 'repo'); assert.equal(item.content, 'Full\n\ncontext'); assert.equal(item.excerpt, 'Full context'); assert.equal(item.title, 'My title'); assert.equal(item.origin.importMethod, 'manual_url');
  assert.equal(item.origin.faviconUrl, 'https://example.org/icon.png');
  const plain = makeLink({ url: 'example.org', title: '', content: '', tags: [] });
  assert.equal(plain.title, 'example.org'); assert.equal(plain.content, undefined); assert.equal(plain.excerpt, '');
});

test('PDF lookup picture is saved with the link and authoritative extracted content', () => {
  const item=makeLink({url:'https://arxiv.org/pdf/2505.22954',title:'Paper',content:'Extracted paper text',tags:['Research'],preview:'data:image/jpeg;base64,dGVzdA=='});
  assert.equal(item.url,'https://arxiv.org/pdf/2505.22954');assert.equal(item.preview,'data:image/jpeg;base64,dGVzdA==');assert.equal(item.origin.previewKind,'screenshot');assert.equal(item.content,'Extracted paper text');
});
test('automatic candidates deduplicate and identify existing URLs before selection', () => {
  const rows = bookmarkCandidates([
    { title: 'Saved', url: 'https://example.org/post/?utm_source=test', folderPath: ['Research'] },
    { title: 'Duplicate', url: 'https://example.org/post#section', folderPath: [] },
    { title: 'New', url: 'https://other.org', folderPath: [] },
    { title: 'Unsafe', url: 'javascript:alert(1)', folderPath: [] },
  ], source, [{ url: 'https://example.org/post' }]);
  assert.equal(rows.length, 2); assert.equal(rows[0].saved, true); assert.equal(rows[1].saved, false);
});
test('cached bookmark favicons feed the import rows and survive saving the new reference', () => {
  const bookmark = { title: 'Page', url: 'https://example.org', folderPath: [], faviconUrl: 'data:image/png;base64,dGVzdA==' };
  assert.equal(bookmarkCandidates([bookmark], source, [])[0].origin.faviconUrl, bookmark.faviconUrl);
  assert.equal(makeBrowserLinks([bookmark], source)[0].origin.faviconUrl, bookmark.faviconUrl);
});
test('browser imports preserve source, original date and folder provenance without invented web content', () => {
  const [item] = makeBrowserLinks([{ title: 'A', url: 'https://example.org', folderPath: ['Bookmarks bar', 'Research'], savedAt: '2026-01-01T00:00:00Z' }], source);
  assert.ok(Date.now() - Date.parse(item.createdAt) < 1000); assert.equal(item.origin.savedAt, '2026-01-01T00:00:00Z'); assert.equal(item.origin.platform, 'Chrome'); assert.equal(item.origin.importMethod, 'browser_bookmarks');
  assert.deepEqual(item.origin.folderPath, ['Bookmarks bar', 'Research']); assert.deepEqual(item.tags, ['Chrome']); assert.equal(item.content, undefined); assert.equal(item.excerpt, '');
});

test('browser source tags cover supported browsers and future Safari without folder tags', () => {
  for (const browser of ['Chrome', 'Edge', 'Firefox', 'Safari']) {
    const [item] = makeBrowserLinks([{ title: 'Page', url: 'https://example.org', folderPath: ['Private folder'] }], { ...source, browser });
    assert.deepEqual(item.tags, [browser]);
    assert.equal(item.origin.platform, browser);
  }
});

test('desktop browser import has no search or batch tags and shares card favicons', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  assert.doesNotMatch(desktop, /Search bookmarks|batchTagsOpen|Add tags|Original files stay unchanged|source\.profile|item\.profile/);
  assert.match(desktop, /<SiteFavicon candidates=\{faviconCandidates\(item\)\}/);
  assert.match(desktop, /label: item.browser/);
  assert.match(desktop, /profiles.length \? profiles : \[next\]/);
  assert.equal((desktop.match(/className=\{styles.tabLabel\}/g) || []).length, 3);
});

test('browser discovery never swaps the import trigger label or changes its identity', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  assert.match(desktop, /DropdownMenu label=\{t\("Import from"\)\}/);
  assert.doesNotMatch(desktop, /Finding browsers|DropdownMenu label=\{sourceLoading/);
  assert.match(desktop, /aria-busy=\{sourceLoading \|\| undefined\}/);
});

test('file tags are validated before import and no page can import a file by path', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const storage = await readFile('src/lib/storage.ts', 'utf8');
  const commands = await readFile('src-tauri/src/library/commands.rs', 'utf8');
  assert.match(desktop, /<ReferenceFileImport/);
  assert.match(await readFile('src/components/ReferenceFileImport.tsx', 'utf8'), /cleanReferenceTags/);
  assert.match(storage, /import_file_payloads/);
  // Files come from dropped bytes or system-dialog tokens, never a page-supplied path.
  assert.doesNotMatch(storage, /"import_files"/);
  assert.doesNotMatch(commands, /fn import_files\b/);
});
test('desktop and MCP share the same three-mode import without bookmark exports', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const library = await readFile('src/features/library/LibraryView.tsx', 'utf8');
  const mcp = await readFile('src/features/mcp-app/McpShelf.tsx', 'utf8');
  assert.match(library, /components\/ReferenceImportDialog/); assert.match(mcp, /components\/ReferenceImportDialog/);
  assert.match(await readFile('src/components/ReferenceImportDialog.tsx', 'utf8'), /\.\/DesktopImportDialog/);
  assert.doesNotMatch(mcp, /components\/AddDialog/);
  assert.match(mcp, /services=\{importServices\}/); assert.match(mcp, /availableTags=\{tags.map/);
  assert.equal((desktop.match(/<TabsTrigger /g) || []).length, 3);
  assert.doesNotMatch(desktop, /Bookmarks HTML|Separate tags with commas|bookmark_html/);
  assert.match(await readFile('src/components/ReferenceTagsField.tsx', 'utf8'), /Press Enter to add a tag/); assert.match(desktop, /slice\(0, visibleCount\)/); assert.match(desktop, /edited.current.title/);
  assert.ok(desktop.indexOf('await onAdd(prepared, persisted)') < desktop.indexOf('onClose();', desktop.indexOf('await onAdd(prepared, persisted)')));
});

test('batch imports save links at once and leave text and covers to one background render each', async () => {
  const items=makeBrowserLinks(Array.from({length:3},(_,i)=>({title:`Saved ${i}`,url:`https://example.org/${i}`,folderPath:[]})),source);
  for(const item of items){assert.equal(item.content,undefined);assert.equal(item.origin.contentSettled,undefined,'eligible for background text');assert.equal(item.preview,undefined);assert.equal(item.origin.importMethod,'browser_bookmarks');}
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const batch = desktop.slice(desktop.indexOf('makeBrowserLinks(available'), desktop.indexOf("'Links could not be imported.'"));
  assert.doesNotMatch(batch, /services\.preview|readImportDetails/, 'no foreground page reads for a batch');
  assert.match(batch, /setProgress\(\{ completed, total: items\.length \}\)/, 'progress follows actual saves');
});

test('temporary native admission pressure is retried, not frozen as an unavailable page',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0;
  const pending=readImportDetails('https://example.org',async()=>{if(++calls===1)throw Error('StashDock is busy. Try again.');return {title:'Page',content:'Actual body'};});
  await new Promise(setImmediate);t.mock.timers.tick(1000);
  assert.equal((await pending).content,'Actual body');assert.equal(calls,2);
});
test('new import surface uses Arc tokens and no competing button overrides', async () => {
  const css = await readFile('src/components/DesktopImportDialog.module.css', 'utf8');
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|(?:rgb|hsl)\(|font-weight:\s*(600|700|bold)|outline:|100vw|linear-gradient/);
  assert.doesNotMatch(css, /\.actions\s+button\s*\{|--text-sm:/);
});

test('batch progress replaces the form in the existing modal instead of stacking a second modal', async () => {
  const desktop = await readFile('src/components/DesktopImportDialog.tsx', 'utf8');
  const dialog = await readFile('src/components/FluidDialog.tsx', 'utf8');
  const css = await readFile('src/components/FluidDialog.module.css', 'utf8');
  assert.equal((desktop.match(/<ImportProgress /g) || []).length, 1);
  assert.match(desktop, /progress=\{progress && <ImportProgress/);
  assert.match(dialog, /pending \? progress : children/);
  assert.match(dialog, /pending \? <DialogPrimitive.Title className=\{styles.visuallyHidden\}/);
  assert.match(dialog, /if \(pending\) surface.current\?\.focus/);
  assert.match(dialog, /typeof current !== 'number' \|\| reduced \|\| pending/);
  assert.match(dialog, /style=\{size === 'import' \? \{ height \} : undefined\}/);
  assert.match(dialog, /onOpenChange=\{next => \{ if \(!next && !props.busy\)/);
  assert.match(css, /\.content\[data-progress\].*360px.*border-radius: var\(--radius-panel\)/);
  assert.match(css, /\.content\[data-progress\] \.body \{ padding: var\(--space-8\)/);
  assert.match(css, /@media \(max-width: 600px\).*data-progress.*padding: var\(--space-6\)/);
  assert.match(css, /\.visuallyHidden.*position: absolute.*clip-path: inset\(50%\)/);
  assert.match(dialog, /parseFloat\(getComputedStyle\(header.current!\).height\)/);
  assert.match(dialog, /parseFloat\(getComputedStyle\(body.current!\).height\)/);
  assert.doesNotMatch(dialog, /getBoundingClientRect\(\).height/);
});

test('approved progress C2 composes the Arc bar with an accessible heading and reduced-motion counter', async () => {
  const component = await readFile('src/components/ImportProgress.tsx', 'utf8');
  const css = await readFile('src/components/ImportProgress.module.css', 'utf8');
  assert.match(component, /aria-labelledby=\{labelId\}/);
  assert.match(component, /id=\{labelId\}/);
  assert.match(component, /if \(reduced\) \{ count.jump\(percentage\); return; \}/);
  assert.match(component, /return \(\) => controls.stop\(\)/);
  assert.match(component, /motionTokens.spring.smooth/);
  assert.doesNotMatch(component, /showValue|setInterval|setTimeout/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.match(css, /margin-bottom: var\(--space-6\)/);
  assert.match(component, /<ImportIllustration \/>/);
  assert.match(css, /\.heading \{ text-align: center/);
  assert.match(css, /\.progressRow \{ display: flex; align-items: center; gap: var\(--space-3\)/);
});

test('production import artwork is fixed C2 at 85 percent with text, image and link cards', async () => {
  const artwork = await readFile('src/components/ImportIllustration.tsx', 'utf8');
  const css = await readFile('src/components/ImportIllustration.module.css', 'utf8');
  assert.match(artwork, /<Paper kind="text" \/><Paper kind="image" \/><Paper kind="link" \/>/);
  assert.match(artwork, /aria-hidden="true"/);
  assert.doesNotMatch(artwork, /brand|useState|setInterval|setTimeout|referenceIcons/);
  assert.match(css, /opacity: \.85/);
  assert.match(css, /data-theme="dark"/);
  assert.doesNotMatch(css, /animation:|transition:|filter:|#[\da-f]{3,8}\b/);
});

test('progress inherits shared dialog gutters and matches its title hierarchy', async () => {
  const dialog = await readFile('src/components/FluidDialog.module.css', 'utf8');
  const progress = await readFile('src/components/ImportProgress.module.css', 'utf8');
  const title = css => css.match(/\.title\s*\{([^}]+)\}/)[1];
  for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing']) {
    const declaration = new RegExp(`${property}:\\s*([^;]+)`);
    assert.equal(title(progress).match(declaration)[1], title(dialog).match(declaration)[1], property);
  }
  assert.match(progress, /\.percentage[^}]+font-size: var\(--text-sm\)/);
  assert.doesNotMatch(progress, /@media/);
  assert.match(dialog, /\.body \{ padding: var\(--space-6\); \}/);
  assert.match(dialog, /@media \(max-width: 560px\)[\s\S]*\.body \{ padding: var\(--space-4\); \}/);
});
