import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/library/session.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { createLibrarySession } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('repeated Files/tag navigation is atomic, complete and idempotent', () => {
  const shelf = createLibrarySession();
  const observed = [];
  shelf.subscribe(() => observed.push(shelf.getSnapshot()));
  const rows = [{ id: 'file', tags: ['Codex'], file: true }, { id: 'web', tags: ['Codex'], file: false }, { id: 'other', tags: [], file: true }];
  for (let i = 0; i < 30; i++) {
    shelf.setFilter('files');
    assert.deepEqual([shelf.getSnapshot().filter, shelf.getSnapshot().activeTag], ['files', null]);
    shelf.setActiveTag('Codex');
    const selected = shelf.getSnapshot();
    assert.deepEqual([selected.filter, selected.activeTag], ['all', 'Codex']);
    assert.deepEqual(rows.filter(row => (selected.filter !== 'files' || row.file) && row.tags.includes(selected.activeTag)).map(row => row.id), ['file', 'web']);
    shelf.setActiveTag('Codex');
    assert.equal(shelf.getSnapshot(), selected, 'reselection must not toggle back to Files');
  }
  assert.ok(observed.every(state => !state.activeTag || state.filter === 'all'), 'subscribers must never see a half-applied destination');
  shelf.dispose();
});

test('presentation changes cannot fork selection, filters, search or layout', () => {
  const shelf = createLibrarySession();
  let dock = shelf.getSnapshot(), library = shelf.getSnapshot();
  const stopDock = shelf.subscribe(() => { dock = shelf.getSnapshot(); });
  shelf.subscribe(() => { library = shelf.getSnapshot(); });
  shelf.setSelectedIds(['a', 'b']); shelf.setQuery('design'); shelf.setFilter('web'); shelf.setActiveTag('Work'); shelf.setView('list');
  assert.equal(dock, library);
  stopDock(); shelf.setSelectedIds(ids => ids.filter(id => id !== 'a'));
  assert.deepEqual(library.selectedIds, ['b']);
  assert.equal(library.query, 'design'); assert.equal(library.view, 'list');
  shelf.dispose();
});
test('refresh reconciliation only removes absent IDs and leaves equal selections stable', () => {
  const shelf = createLibrarySession(); shelf.setSelectedIds(['b', 'a']); shelf.setCopied(true);
  const selected = shelf.getSnapshot().selectedIds;
  shelf.prune(new Set(['a', 'b']));
  assert.equal(shelf.getSnapshot().selectedIds, selected); assert.equal(shelf.getSnapshot().copied, true);
  shelf.setCopiedItemId('a'); shelf.prune(new Set(['b']));
  assert.deepEqual(shelf.getSnapshot().selectedIds, ['b']); assert.equal(shelf.getSnapshot().copied, false); assert.equal(shelf.getSnapshot().copiedItemId, null);
  shelf.dispose();
});
test('success feedback belongs to the shared session and replacement cancels older expiry', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const shelf = createLibrarySession(); shelf.setCopied(true, 1800); shelf.setCopiedItemId('a', 1800);
  t.mock.timers.tick(1000); shelf.setCopied(true, 1800);
  t.mock.timers.tick(800); assert.equal(shelf.getSnapshot().copied, true); assert.equal(shelf.getSnapshot().copiedItemId, null);
  t.mock.timers.tick(1000); assert.equal(shelf.getSnapshot().copied, false);
  shelf.setCopied(true); shelf.setSelectedIds(['new']); assert.equal(shelf.getSnapshot().copied, false);
  shelf.dispose();
});
test('both refresh controls share one flight and recover after failure', async () => {
  const shelf = createLibrarySession(); let finish, calls = 0;
  const load = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const flight = shelf.refresh(load); assert.equal(shelf.refresh(load), flight);
  assert.equal(shelf.getSnapshot().refreshing, true);
  await Promise.resolve(); finish(); await flight;
  assert.equal(calls, 1); assert.equal(shelf.getSnapshot().refreshing, false);
  await assert.rejects(shelf.refresh(async () => { throw Error('fixture'); }));
  assert.equal(shelf.getSnapshot().refreshing, false);
  await shelf.refresh(async () => {}); shelf.dispose();
});
test('grid and list preserve the same source and action DOM with one collection map', async () => {
  const view = await readFile(new URL('../src/features/library/LibraryView.tsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/components/StashCard.tsx', import.meta.url), 'utf8');
  assert.equal((view.match(/visibleItems.map/g) || []).length, 1);
  assert.equal((card.match(/<SiteIdentity/g) || []).length, 1);
  assert.doesNotMatch(card, /import \{ Card \}/);
  assert.equal((card.match(/const source =/g) || []).length, 1);
  assert.equal((card.match(/\{source\}/g) || []).length, 1);
  assert.doesNotMatch(card, /if \(view === "list"\)/);
  for (const path of ['../src/components/ContextBar.tsx','../src/features/library/useLibraryController.ts']) {
    assert.doesNotMatch(await readFile(new URL(path, import.meta.url), 'utf8'), /Copy \+ open Codex|Copy context|codex:\/\/|handleSendToCodex/);
  }
});
test('search cache and notices survive shape changes without re-running the search', () => {
  const shelf=createLibrarySession(), items=[];
  shelf.setQuery('paper'); shelf.setSearch({query:'paper',items,results:[]}); shelf.setNotice('Clipboard access was blocked.');
  const cached=shelf.getSnapshot().search;
  shelf.setView('list'); shelf.setFilter('web');
  assert.equal(shelf.getSnapshot().search,cached);
  assert.equal(shelf.getSnapshot().notice,'Clipboard access was blocked.');
  shelf.setNotice(null); assert.equal(shelf.getSnapshot().notice,null); shelf.dispose();
});
