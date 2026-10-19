// One immutable per-user anchor, shared with native library_location.rs. Moves
// follow the existing retired-database redirects; an environment override only
// seeds the very first registration and cannot fork a later client.
import { existsSync, mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, linkSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
export function locateLibrary(preferred, registry) {
  mkdirSync(dirname(registry), { recursive: true });
  if (!existsSync(registry)) {
    if (!isAbsolute(preferred)) throw Error('The library location must be absolute.');
    const temporary = `${registry}.${randomUUID()}.tmp`;
    const fd = openSync(temporary, 'wx');
    try { writeFileSync(fd, JSON.stringify({ version: 1, anchor: preferred, initialized: existsSync(`${preferred}/stashdock.sqlite3`) })); fsyncSync(fd); }
    finally { closeSync(fd); }
    try { linkSync(temporary, registry); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    finally { unlinkSync(temporary); }
  }
  const bytes = readFileSync(registry);
  if (bytes.length > 65536) throw Error('The StashDock library registration is invalid.');
  const record = JSON.parse(bytes.toString('utf8'));
  if (record.version !== 1 || typeof record.anchor !== 'string' || !isAbsolute(record.anchor) || typeof record.initialized !== 'boolean') throw Error('The StashDock library registration is invalid.');
  if (record.initialized && !existsSync(`${record.anchor}/stashdock.sqlite3`)) throw Error('The StashDock library is unavailable. Reconnect its drive and retry.');
  return { registry, version: record.version, anchor: record.anchor, initialized: record.initialized };
}
export function markLibraryReady(location) {
  if (location.initialized) return;
  const current = locateLibrary(location.anchor, location.registry);
  if (current.anchor !== location.anchor) throw Error('The library registration changed. Reopen StashDock.');
  const temporary = `${location.registry}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, 'wx');
  try { writeFileSync(fd, JSON.stringify({ version: 1, anchor: location.anchor, initialized: true })); fsyncSync(fd); }
  finally { closeSync(fd); }
  try { renameSync(temporary, location.registry); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
