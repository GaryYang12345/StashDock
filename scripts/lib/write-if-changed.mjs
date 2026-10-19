import { readFile, writeFile } from 'node:fs/promises';

/** Keep mtimes stable: embedded native assets must not invalidate Cargo when
 * regeneration produces exactly the same bytes. Caller owns the directory. */
export async function writeIfChanged(path, content) {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  try { if ((await readFile(path)).equals(next)) return false; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path, next);
  return true;
}
