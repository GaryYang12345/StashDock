// Read-only migration guard: report modified copies from the superseded opener.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
const database = new DatabaseSync('D:/StashDockData/stashdock.sqlite3', { readOnly: true });
try {
  const notes = database.prepare("SELECT title,COALESCE(context_override,content,excerpt,'') AS body FROM stash_items WHERE kind='note'").all();
  const root = join(tmpdir(), 'StashDock', 'notes');
  const files = existsSync(root) ? readdirSync(root, { recursive: true }).filter(path => path.endsWith('.txt')).map(path => join(root, path)) : [];
  const changed = [];
  let matches = 0;
  for (const note of notes) {
    const name = 'Note - ' + Array.from(note.title).slice(0, 48).map(c => /[\p{Cc}<>:"/\\|?*]/u.test(c) ? '-' : c).join('').replace(/^[ .]+|[ .]+$/g, '') + '.txt';
    for (const file of files.filter(path => basename(path) === name)) {
      matches++; if (readFileSync(file, 'utf8') !== note.body) changed.push({ title: note.title, file });
    }
  }
  console.log(JSON.stringify({ notes: notes.length, previouslyOpenedCopies: matches, changedCopies: changed }));
} finally { database.close(); }
