import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { resolveLanguage, translate, zh } from '../src/features/settings/messages.mjs';
import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
import { resolveLibraryDirectory } from '../plugins/stashdock/server/library-location.mjs';

test('interface locale resolves explicitly and substitutes user text only once', () => {
  assert.equal(resolveLanguage('system', 'zh-CN'), 'zh');
  assert.equal(resolveLanguage('system', 'en-US'), 'en');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage('zh', 'en'), 'zh');
  assert.equal(translate('en', 'Settings'), 'Settings');
  assert.equal(translate('zh', 'Settings'), '设置');
  assert.equal(translate('zh', 'Open {title}', { title: 'Settings {count}' }), '打开“Settings {count}”');
  assert.equal(translate('zh', 'Unknown backend error'), 'Unknown backend error');
});

test('translated UI never uses localized text as data identity, or translates reference content', () => {
  for (const file of ['src/components/DesktopImportDialog.tsx', 'src/components/StashCard.tsx', 'src/components/ReferenceFileImport.tsx', 'src/features/library/LibraryView.tsx']) {
    const source = readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 't') {
        const parent = node.parent;
        assert.ok(!ts.isBinaryExpression(parent) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind), `${file}: translated state identity`);
        assert.doesNotMatch(node.arguments[0]?.getText(ast) || '', /^item\.(?:title|content|excerpt)|^tag\.name$/, `${file}: translated user content`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  for (const key of ['Settings', 'Language', 'Theme', 'Storage location', 'Save link', 'Save note', 'Save file', 'Edit card', 'Delete reference', 'Choose tags']) assert.ok(zh[key], key);
  assert.match(readFileSync('src/features/settings/locale.tsx', 'utf8'), /createContext<InterfaceLanguage>\('en'\)/);
  assert.doesNotMatch(readFileSync('src/features/mcp-app/main.tsx', 'utf8'), /DesktopPreferencesProvider/);
  assert.match(readFileSync('src/features/settings/preferences.tsx', 'utf8'), /if \(!info\) return;\s+const apply/);
});

test('desktop settings stay small and use the published repository without fabricated store links', () => {
  const source = readFileSync('src/features/settings/SettingsView.tsx', 'utf8');
  assert.doesNotMatch(source, /backup|restore|telemetry|diagnostic|clear.cache/i);
  assert.match(source, /info\.githubUrl &&/);
  const links = JSON.parse(readFileSync('src-tauri/product-links.json', 'utf8'));
  assert.equal(links.githubRepository, 'GaryYang12345/StashDock');
  // Installation buttons open the matching section of the website guide.
  assert.equal(links.installationUrls.desktop, 'https://stashdock.app/guide#install-desktop');
  assert.equal(links.installationUrls.codex, 'https://stashdock.app/guide#install-plugin');
  assert.equal(links.installationUrls.chrome, 'https://stashdock.app/guide#install-browser');
  for (const id of ['edge', 'firefox', 'safari', 'claude']) assert.equal(links.installationUrls[id], null);
  const guide = readFileSync('website/src/guide/Guide.tsx', 'utf8');
  for (const url of Object.values(links.installationUrls).filter(Boolean)) assert.match(guide, new RegExp(`id="${new URL(url).hash.slice(1)}"`));
  assert.match(source, /<StorageSection/);
  assert.match(source, /await invoke\('restart_desktop'\)/);
  assert.match(readFileSync('src/features/library/LibraryView.tsx', 'utf8'), /hidden=\{settingsOpen\}/);
});

test('already-running and newly-opened MCP libraries follow a moved desktop library without replaying writes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-location-node-'));
  const old = join(root, 'old'), destination = join(root, 'new');
  const live = createLocalLibrary({ dataDir: old });
  const item = live.importItems([{ title: 'Settings', kind: 'note', source: 'Personal note', tags: ['Settings'], content: 'Keep original content', createdAt: '2026-10-15T00:00:00Z' }]).items[0];
  const savedRead = live.read;
  const source = new DatabaseSync(join(old, 'stashdock.sqlite3'));
  let reopened;
  try {
    mkdirSync(destination); await backup(source, join(destination, 'stashdock.sqlite3'));
    source.prepare('INSERT INTO app_meta VALUES (?,?)').run('library_location_v1', destination);
    source.exec("CREATE TRIGGER moved BEFORE UPDATE ON stash_items BEGIN SELECT RAISE(ABORT,'Library moved'); END");
    live.setFavorite(item.id, true);
    assert.equal((await savedRead())[0].favorite, true);
    assert.equal(source.prepare('SELECT favorite FROM stash_items').get().favorite, 0);
    reopened = createLocalLibrary({ dataDir: old });
    const row = (await reopened.read())[0];
    assert.equal(row.favorite, true); assert.equal(row.title, 'Settings'); assert.deepEqual(row.tags, ['Settings']); assert.equal(row.content, 'Keep original content');
    assert.equal(live.dataDir, destination); assert.equal(resolveLibraryDirectory(old), destination);
  } finally { reopened?.close(); live.close(); source.close(); rmSync(root, { recursive: true, force: true }); }
});

test('missing moved storage never opens a new empty library and redirect loops fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'stashdock-location-invalid-'));
  const live = createLocalLibrary({ dataDir: root }); live.close();
  const db = new DatabaseSync(join(root, 'stashdock.sqlite3'));
  try {
    db.prepare('INSERT INTO app_meta VALUES (?,?)').run('library_location_v1', join(root, 'missing'));
    assert.throws(() => createLocalLibrary({ dataDir: root }), /unavailable/);
    db.prepare('UPDATE app_meta SET value=? WHERE key=?').run(root, 'library_location_v1');
    assert.throws(() => resolveLibraryDirectory(root), /loop/);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
