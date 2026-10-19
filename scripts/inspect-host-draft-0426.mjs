// Read-only host protocol investigation. Never reads conversation/profile data,
// modifies the host archive, or calls private host IPC.
import { openSync, readSync, closeSync } from 'node:fs';
const fd = openSync(process.argv[2], 'r');
try {
  const prefix = Buffer.alloc(16); readSync(fd, prefix, 0, 16, 0);
  const headerSize = prefix.readUInt32LE(4), jsonSize = prefix.readUInt32LE(12);
  if (jsonSize > 20_000_000 || headerSize < jsonSize) throw Error('Invalid ASAR');
  const buf = Buffer.alloc(jsonSize); readSync(fd, buf, 0, jsonSize, 16);
  const root = JSON.parse(buf.toString());
  function walk(files, path = '') {
    for (const [name, entry] of Object.entries(files)) {
      const file = path + name;
      if (entry.files) { walk(entry.files, file + '/'); continue; }
      if (entry.unpacked || !/webview\/assets\/widget-.*\.js$/.test(file) || entry.size > 20_000_000) continue;
      const bytes = Buffer.alloc(entry.size);
      readSync(fd, bytes, 0, bytes.length, 8 + headerSize + Number(entry.offset));
      const code = bytes.toString();
      for (const term of ['host-context-changed', 'send===!1', 'draft:{}', 'hostContext:', 'ui/initialize']) {
        let start = 0, count = 0;
        while ((start = code.indexOf(term, start)) >= 0 && count++ < 3) {
          console.log(JSON.stringify({file,term,snippet:code.slice(Math.max(0,start-220),start+850)}));
          start += term.length;
        }
      }
    }
  }
  walk(root.files);
} finally { closeSync(fd); }
