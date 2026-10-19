// Build-time download only. End users receive the verified runtime in the ZIP.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(resolve(root, 'scripts/node-runtime-lock.json'), 'utf8'));
if (process.platform !== lock.platform || process.arch !== lock.arch) throw Error('Prepare and verify the matching platform runtime before packaging.');
const folder = resolve(root, 'build-runtime/node', `${lock.platform}-${lock.arch}`);
await mkdir(folder, { recursive: true });
const target = resolve(folder, 'node.exe');
const digest = async path => { const hash = createHash('sha256'); for await (const bytes of createReadStream(path)) hash.update(bytes); return hash.digest('hex'); };
let valid = false;
try { valid = await digest(target) === lock.sha256; } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!valid) {
  const response = await fetch(lock.url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok || new URL(response.url).hostname !== 'nodejs.org') throw Error('Official Node runtime download failed.');
  let size = 0;
  const temporary = `${target}.${process.pid}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(bytes, _encoding, done) {
      size += bytes.length; done(size > 150_000_000 ? Error('Node runtime exceeds its size bound.') : null, bytes);
    } }), createWriteStream(temporary, { flags: 'wx' }));
    if (await digest(temporary) !== lock.sha256) throw Error('Node runtime checksum does not match the release pin.');
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
}
const license = resolve(folder, 'LICENSE');
try { await stat(license); } catch {
  const response = await fetch(lock.licenseUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw Error('Official Node license is unavailable.');
  const bytes = await response.text();
  if (!bytes.includes('Node.js') || bytes.length > 1_000_000) throw Error('Invalid Node runtime license.');
  await writeFile(license, bytes);
}
console.log(JSON.stringify({ version: lock.version, verified: true, bytes: (await stat(target)).size, folder }));
