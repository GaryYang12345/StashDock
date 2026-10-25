import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { buildContext } from '../src/lib/context-format.mjs';

const compiled = await build({ entryPoints: ['website/src/demo-data.ts'], bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.ico': 'dataurl' } });
const { demoLibrary, matches, demoTagNames } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const copyBundle = await build({ entryPoints: ['website/src/copy.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { copy } = await import('data:text/javascript;base64,' + Buffer.from(copyBundle.outputFiles[0].text).toString('base64'));
const editBundle = await build({ entryPoints: ['website/src/demo-editing.ts'], bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.ico': 'dataurl' } });
const { editDemoCard, editDemoContent } = await import('data:text/javascript;base64,' + Buffer.from(editBundle.outputFiles[0].text).toString('base64'));
const captured = JSON.parse(await readFile('website/src/data/saved-reference-content.json', 'utf8'));
const navigationBundle = await build({ entryPoints: ['website/src/demo-navigation.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { demoCard, demoLink, openDemoReference } = await import('data:text/javascript;base64,' + Buffer.from(navigationBundle.outputFiles[0].text).toString('base64'));

test('demo source actions open real public URLs and never expose fictitious file targets', () => {
  const calls = [], previousWindow = globalThis.window;
  globalThis.window = { open: (...args) => calls.push(args) };
  try {
    for (const item of demoLibrary('en')) {
      const card = demoCard(item);
      assert.equal(card.assetPath, undefined); assert.equal(card.hasFile, undefined); assert.equal(card.originalPath, undefined);
      if (['web', 'repo'].includes(item.kind)) {
        assert.equal(card.url, item.url); openDemoReference(card);
      } else assert.equal(card.url, undefined);
    }
    assert.equal(calls.length, 18);
    assert.ok(calls.every(([, target, features]) => target === '_blank' && features === 'noopener,noreferrer'));
    for (const url of ['javascript:alert(1)', 'file:///private', 'https://user:pass@example.org', 'invalid']) {
      const item = { kind: 'web', url };
      assert.equal(demoLink(item), undefined); openDemoReference(item);
    }
    assert.equal(calls.length, 18);
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});

test('Design Spells removes duplicate labels and listing numbers while retaining all nine examples', () => {
  const text = demoLibrary('en').find(item => item.id === 'design-spells').content;
  for (const phrase of ['Bookmark sheet transitions', 'Effort picker animations', 'Contributors carousel', 'Orb picker', 'Hidden snake minigame', 'Skeuomorphic traditional', 'Smooth sheet transitions', 'Pretzel Pong minigame', 'Interactive magnifier']) {
    assert.equal(text.split(phrase).length - 1, 1, phrase);
  }
  assert.doesNotMatch(text, /\b(?:344|343|342|341|340|339|338|337|336)\b/);
});

test('saved demo bodies preserve the complete locally read snapshot and its real capture status', () => {
  const lengths = { 'design-spells': 534, 'sft-rl-opd': 20000, seeco: 15450, darkzodchi: 12004, 'bay-weekend': 922, 'basic-pitch': 842, 'arc-ui': 594, 'laws-of-ux': 3881, 'gui-harvest': 2276, 'oregon-101': 951, 'intelligence-index': 8972, 'ucb-sakana': 1003 };
  for (const language of ['en', 'zh']) {
    const library = demoLibrary(language);
    for (const [id, length] of Object.entries(lengths)) {
      const item = library.find(item => item.id === id);
      assert.equal(item.content, captured[id].content, `${id}: no website truncation`);
      assert.equal(item.content.length, length, id);
      assert.equal(item.origin.truncated, captured[id].captureTruncated, id);
      assert.equal(item.origin.truncated, ['sft-rl-opd', 'darkzodchi'].includes(id));
      assert.ok(buildContext([item]).includes(item.content), `${id}: editor/copy retains the whole saved body`);
    }
  }
});

test('every demo reference has useful context; missing captures are labelled authored overviews', () => {
  const en = demoLibrary('en'), zh = demoLibrary('zh');
  for (const item of en) {
    assert.ok(item.content.trim().length >= 200, item.id);
    assert.equal(zh.find(other => other.id === item.id).content, item.content, item.id);
    assert.ok(buildContext([item]).includes(item.content), item.id);
    assert.doesNotMatch(buildContext([item]), /Page content was not saved\./, item.id);
  }
  for (const id of ['seeco', 'darkzodchi']) {
    const item = en.find(item => item.id === id);
    assert.equal(item.content, captured[id].content);
    assert.ok(item.content.length > 10000);
    assert.doesNotMatch(item.content, /^Reference overview|Want to publish your own Article|Upgrade to Plus/);
    assert.equal(item.origin.contentOrigin, 'provided');
  }
  const uiverse = en.find(item => item.id === 'uiverse');
  assert.match(uiverse.content, /^Reference overview/);
  assert.ok(uiverse.content.endsWith(captured.uiverse.content));
  for (const id of ['plot-color', 'card-ui', 'korea-artist']) {
    const item = en.find(item => item.id === id);
    assert.match(item.content, /^Image reference notes/);
    assert.equal(item.origin.contentOrigin, 'generated');
  }
  for (const id of ['spec', 'model', 'interviews']) assert.match(en.find(item => item.id === id).content, /^Demo (document|spreadsheet) annotation/);
  assert.doesNotMatch(JSON.stringify(captured), /xsec_token|access_token|StashDockData|[A-Z]:\\\\|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
});

test('demo edits update metadata and final context without changing original samples', () => {
  const original = demoLibrary('en').find(item => item.id === 'design-spells');
  const before = structuredClone(original);
  const edited = editDemoCard(original, original, '  Interface references  ', ['Design', 'design', ' Writing ']);
  assert.equal(edited.title, 'Interface references');
  assert.deepEqual(edited.tags, ['Design', 'Writing']);
  assert.equal(edited.url, original.url);
  assert.equal(edited.origin.faviconUrl, original.origin.faviconUrl);
  assert.match(buildContext([edited]), /## Interface references\nURL: https:\/\/designspells.com\//);
  const context = editDemoContent(edited, '# A reusable writing rule');
  assert.equal(context.contextOverride, '# A reusable writing rule');
  assert.equal(buildContext([context]), '# A reusable writing rule');
  assert.equal(context.content, original.content);
  assert.equal(editDemoContent(context, '').contextOverride, '');
  assert.deepEqual(original, before);
  assert.equal(demoLibrary('en').find(item => item.id === original.id).title, original.title);
  assert.throws(() => editDemoCard(original, original, ' ', []));
  assert.throws(() => editDemoCard(original, original, 'Title', ['x'.repeat(49)]));
  assert.throws(() => editDemoContent(original, 'x'.repeat(200_001)));
});

test('demo covers save explicitly and restore the original bundled cover', () => {
  const original = demoLibrary('en')[0];
  const custom = editDemoCard(original, original, original.title, original.tags, { preview: 'data:image/jpeg;base64,demo' });
  assert.equal(custom.origin.previewSource, 'custom');
  assert.equal(custom.preview, 'data:image/jpeg;base64,demo');
  const unchanged = editDemoCard(custom, original, 'New title', custom.tags);
  assert.equal(unchanged.preview, custom.preview);
  const restored = editDemoCard(custom, original, custom.title, custom.tags, { preview: null });
  assert.equal(restored.preview, original.preview);
  assert.equal(restored.origin.previewSource, undefined);
});

test('desktop and plugin demos share the real product menu and editors', async () => {
  for (const file of ['LiveDemo', 'DesktopDemo']) {
    const source = await readFile(`website/src/sections/${file}.tsx`, 'utf8');
    assert.match(source, /useDemoLibrary\(language\)/);
    assert.match(source, /useDemoReferenceEditors/);
    assert.match(source, /onEdit=\{/);
    assert.match(source, /onEditContent=\{/);
    assert.match(source, /\{editor.dialogs\}/);
    assert.match(source, /demo.resetEdits\(\)/);
  }
  const adapter = await readFile('website/src/parts/DemoReferenceEditors.tsx', 'utf8');
  assert.match(adapter, /<ReferenceEditor/);
  assert.match(adapter, /<ContentEditor/);
  assert.match(adapter, /returnFocus=\{returnFocus\}/);
  assert.doesNotMatch(adapter, /invoke\(|callServerTool|localStorage|fetch\(/);
});

test('hero decoration uses the approved eight references and local source identities', async () => {
  const source = await readFile('website/src/parts/HeroReferences.tsx', 'utf8');
  const layoutSource = await readFile('website/src/hero-reference-layout.ts', 'utf8');
  const ids = [...layoutSource.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(ids, ['anti-defensive', 'sft-rl-opd', 'design-spells', 'plot-color', 'seeco', 'korea-artist', 'oregon-101', 'uiverse']);
  const library = demoLibrary('en');
  for (const id of ids) {
    const item = library.find(candidate => candidate.id === id);
    assert.ok(item?.preview, id);
    if (item.kind === 'web') assert.match(item.origin.faviconUrl, /^data:image\//, id);
  }
  assert.match(source, /aria-hidden="true" inert/);
  assert.match(source, /<SiteIdentity item=\{item\}/);
  assert.match(source, /<ReferenceGlyph kind="web"/);
});

test('website web examples have real public URLs, bundled raster previews and source icons', () => {
  for (const language of ['en', 'zh']) {
    const items = demoLibrary(language);
    assert.equal(items.length, 27);
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    const web = items.filter(item => item.kind === 'web' || item.kind === 'repo');
    assert.equal(web.length, 18);
    for (const item of web) {
      assert.equal(new URL(item.url).protocol, 'https:');
      assert.doesNotMatch(item.url, /\.example\b|github.com\/example|\/status\/1$/);
      assert.match(item.preview, /^data:image\/(jpeg|png);base64,/);
      assert.ok(item.preview.length > 20_000, item.title);
      if (item.origin.faviconUrl) assert.match(item.origin.faviconUrl, /^data:image\//);
      assert.ok(['provided', 'generated'].includes(item.origin.contentOrigin));
    }
    assert.equal(items.filter(item => item.preview).length, 22);
    for (const kind of ['note', 'image', 'file', 'repo', 'web']) assert.ok(items.some(item => item.kind === kind));
  }
});

test('sample library keeps identity across languages and serves design, AI and harness searches', () => {
  const en = demoLibrary('en'), zh = demoLibrary('zh');
  assert.deepEqual(en.map(item => [item.id, item.url, item.preview]), zh.map(item => [item.id, item.url, item.preview]));
  assert.ok(matches(en, 'design').some(item => item.id === 'radix'));
  assert.ok(matches(zh, '设计').some(item => item.id === 'radix'));
  assert.ok(matches(en, 'harness').some(item => item.id === 'deepagents'));
  assert.ok(matches(en, 'AI').some(item => item.id === 'attention'));
  assert.deepEqual(matches(en, 'nonexistent sample query'), []);
});

test('all demo cards share five consistent, relevant tag categories', () => {
  assert.deepEqual(demoTagNames, ['Design', 'AI', 'Writing', 'Travel', 'Work']);
  for (const language of ['en', 'zh']) {
    const items = demoLibrary(language);
    const counts = Object.fromEntries(demoTagNames.map(tag => [tag, items.filter(item => item.tags.includes(tag)).length]));
    assert.deepEqual(counts, { Design: 9, AI: 10, Writing: 2, Travel: 2, Work: 5 });
    for (const item of items) {
      assert.ok(item.tags.length >= 1 && item.tags.length <= 2, item.id);
      assert.equal(new Set(item.tags).size, item.tags.length);
      for (const tag of item.tags) assert.ok(demoTagNames.includes(tag), tag);
    }
    assert.deepEqual(items.find(item => item.id === 'bay-weekend').tags, ['Travel']);
    assert.deepEqual(items.find(item => item.id === 'anti-defensive').tags, ['Writing']);
    assert.deepEqual(items.find(item => item.id === 'seeco').tags, ['Design', 'AI']);
  }
  assert.deepEqual(demoLibrary('en').map(item => item.tags), demoLibrary('zh').map(item => item.tags));
});

test('plugin positioning is host-neutral while installation names the available host', () => {
  assert.match(copy.en.demo.body, /With the AI plugin/);
  assert.match(copy.en.platforms.body, /beside your AI chat/);
  assert.match(copy.en.local.pluginBody, /your AI app/);
  for (const language of ['en', 'zh']) {
    const text = copy[language];
    for (const value of [text.demo.body, text.platforms.body, text.local.pluginBody]) assert.doesNotMatch(value, /ChatGPT|Codex/);
    assert.doesNotMatch(text.download.pluginMeta, /Codex/);
    assert.match(text.download.pluginMeta, /ChatGPT/);
    assert.ok(text.download.pluginSoon);
  }
  assert.equal(copy.en.download.pluginMeta, 'For ChatGPT');
  assert.equal(copy.en.download.pluginSoon, 'More AI plugins coming soon.');
});

test('demo leads with links and interleaves design images', () => {
  for (const language of ['en', 'zh']) {
    const items = demoLibrary(language);
    assert.deepEqual(items.slice(0, 6).map(item => item.id), ['design-spells', 'sft-rl-opd', 'seeco', 'uiverse', 'bay-weekend', 'basic-pitch']);
    assert.deepEqual(items.flatMap((item, index) => item.kind === 'image' ? [index] : []), [6, 11, 14]);
  }
});

test('selected saved references replace the four retired examples without leaking library metadata', () => {
  const en = demoLibrary('en'), zh = demoLibrary('zh');
  const selected = ['plot-color', 'card-ui', 'korea-artist', 'arc-ui', 'bay-weekend', 'oregon-101', 'ucb-sakana', 'intelligence-index', 'gui-harvest', 'darkzodchi', 'seeco', 'laws-of-ux', 'sft-rl-opd', 'design-spells', 'uiverse', 'basic-pitch'];
  for (const id of selected) {
    const item = en.find(item => item.id === id);
    assert.ok(item, id);
    assert.equal(item.title, zh.find(item => item.id === id).title, 'Never translate saved user content');
    assert.equal(item.origin.contentOrigin, ['plot-color', 'card-ui', 'korea-artist', 'uiverse'].includes(id) ? 'generated' : 'provided');
    assert.ok(!item.url || !new URL(item.url).search, 'No temporary access parameters');
    assert.ok(!item.originalPath);
  }
  for (const id of ['threejs', 'pillars-image', 'longevity', 'rules']) assert.ok(!en.some(item => item.id === id));
  for (const id of ['plot-color', 'card-ui', 'korea-artist']) {
    const image = en.find(item => item.id === id);
    assert.equal(image.kind, 'image');
    assert.match(image.preview, /^data:image\/jpeg;base64,/);
    assert.equal(image.hasFile, true);
  }
  assert.match(en.find(item => item.id === 'seeco').content, /More coming soon\.$/);
  assert.match(en.find(item => item.id === 'darkzodchi').content, /https:\/\/zodchiii.substack.com\/$/);
  const json = JSON.stringify(en.map(({ content: _content, excerpt: _excerpt, ...metadata }) => metadata));
  assert.doesNotMatch(json, /xsec_token|originalFingerprint|fileFingerprint|StashDockData|微信图片|[A-Z]:\\/);
});

test('writing note is an English authored sample reused across languages and demos', async () => {
  for (const language of ['en', 'zh']) {
    const note = demoLibrary(language).find(item => item.id === 'anti-defensive');
    assert.equal(note.origin.contentOrigin, 'generated');
    assert.ok(note.content.length > 600);
    assert.doesNotMatch(note.title + note.excerpt + note.content, /\p{Script=Han}/u);
    assert.match(note.content, /evidence/);
    assert.match(note.preview, /^data:image\/jpeg;base64,/);
  }
  const copy = await readFile('website/src/copy.ts', 'utf8');
  for (const key of ['user1', 'tool', 'agent1', 'later', 'user2', 'tool2', 'agent2']) {
    assert.match(copy, new RegExp(`${key}: en\\.agents\\.${key}`));
  }
  const pillars = await readFile('website/src/sections/Pillars.tsx', 'utf8');
  assert.match(pillars, /className="agents-note-cover" src=\{rule.preview\}/);
  const ids = pillars.match(/const bookmarks = [^\n]+/)[0].matchAll(/'([^']+)'/g);
  const items = demoLibrary('en');
  for (const [, id] of ids) assert.notEqual(new URL(items.find(item => item.id === id).url).hostname, 'www.xiaohongshu.com');
});

test('new repositories cover OPD and agent harnesses; fresh calls do not share mutable tags', () => {
  const first = demoLibrary('en');
  assert.equal(first.find(item => item.id === 'verl').url, 'https://github.com/verl-project/verl');
  assert.match(first.find(item => item.id === 'verl').content, /on-policy distillation/);
  assert.equal(first.find(item => item.id === 'deepagents').url, 'https://github.com/langchain-ai/deepagents');
  assert.match(first.find(item => item.id === 'deepagents').content, /agent harness/);
  first.find(item => item.id === 'card-ui').tags.push('changed');
  assert.ok(!demoLibrary('en').find(item => item.id === 'card-ui').tags.includes('changed'));
});

test('composer has no hidden suggested question and autoplay waits 800 ms with reduced-motion opt-out', async () => {
  const composer = await readFile('website/src/parts/ChatWindow.tsx', 'utf8');
  assert.doesNotMatch(composer, /\bask\b/);
  assert.match(composer, /placeholder=\{chips.length \? '' : placeholder\}/);
  assert.match(composer, /disabled=\{!chips.length \|\| !draft.trim\(\) \|\| thinking\}/);
  const pillars = await readFile('website/src/sections/Pillars.tsx', 'utf8');
  const ids = new Set(demoLibrary('en').map(item => item.id));
  for (const [, id] of pillars.matchAll(/pick\('([^']+)'\)/g)) assert.ok(ids.has(id), `Unresolved demo reference: ${id}`);
  const playback = await readFile('website/src/parts/DemoPlayback.tsx', 'utf8');
  assert.match(pillars, /import \{ ReplayButton, useFirstView \} from '..\/parts\/DemoPlayback'/);
  assert.match(playback, /const SETTLE_MS = 800;/);
  assert.match(playback, /if \(!inView \|\| reduced\) return;/);
});
