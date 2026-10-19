import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { displayLibraryDirectory } from './library-location.mjs';

export const CODEX_PREFERENCES_KEY = 'codex_preferences_v1';
const values = { language: ['system', 'en', 'zh'], theme: ['system', 'light', 'dark'] };
export function readCodexPreferences(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { /* Invalid optional preferences never prevent opening the shelf. */ }
  return Object.fromEntries(Object.entries(values).map(([key, options]) => [key, options.includes(value?.[key]) ? value[key] : 'system']));
}
export function patchCodexPreferences(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length ||
      Object.entries(patch).some(([key, value]) => !values[key]?.includes(value))) throw Error('Choose a supported language or theme.');
  return { ...current, ...patch };
}
// Same storage boundary as desktop: SQLite and its journals, plus managed
// regular assets. Never follow symlinks or scan unrelated folders recursively.
export async function readStorageInfo(library) {
  const root = library.dataDir;
  const references = library.referenceCount();
  let bytes = 0;
  const add = async path => { try { const stat = await lstat(path); if (stat.isFile()) bytes += stat.size; } catch (error) { if (error.code !== 'ENOENT') throw error; } };
  await Promise.all(['stashdock.sqlite3', 'stashdock.sqlite3-wal', 'stashdock.sqlite3-shm'].map(name => add(join(root, name))));
  for (const entry of await readdir(join(root, 'assets'), { withFileTypes: true })) if (entry.isFile()) await add(join(root, 'assets', entry.name));
  return { path: displayLibraryDirectory(root), bytes, references };
}
