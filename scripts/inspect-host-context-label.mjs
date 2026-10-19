// Read-only inspection of the installed host's public protocol handling.
// Does not inspect user profiles, modify the host, or call private host APIs.
import { openSync, readSync, closeSync } from 'node:fs';
const archive = process.argv[2];
const fd = openSync(archive, 'r');
try {
  const prefix = Buffer.alloc(16); readSync(fd, prefix, 0, 16, 0);
  const headerSize = prefix.readUInt32LE(4), jsonSize = prefix.readUInt32LE(12);
  if (jsonSize > 20_000_000 || headerSize < jsonSize) throw Error('Invalid ASAR header');
  const json = Buffer.alloc(jsonSize); readSync(fd, json, 0, jsonSize, 16);
  const header = JSON.parse(json.toString());
  function walk(files, base = '') {
    for (const [name, entry] of Object.entries(files)) {
      const path = base + name;
      if (entry.files) { walk(entry.files, path + '/'); continue; }
      if (!path.endsWith('.js') || entry.unpacked || !/webview\/assets\/(?:app-initial|app-primary|zh-CN)-/.test(path) || entry.size > 20_000_000) continue;
      const buf = Buffer.alloc(entry.size); readSync(fd, buf, 0, entry.size, 8 + headerSize + Number(entry.offset));
      const text = buf.toString();
      for (const term of ['openai/title', 'openai/message', 'send===!1', 'composer.mcpAppModelContext.contextCount', 'composer.mcpAppModelContext.singleContextLabel']) {
        let start = 0, count = 0;
        while ((start = text.indexOf(term, start)) >= 0 && count++ < 2) {
          console.log(JSON.stringify({ file: path, term, snippet: text.slice(Math.max(0, start - 500), start + 1100) })); start += term.length;
        }
      }
    }
  }
  walk(header.files);
} finally { closeSync(fd); }
