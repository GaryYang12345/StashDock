// Simulate a normal editor's atomic Save, only inside the owned disposable fixture.
import { writeFileSync, renameSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, isAbsolute, sep } from 'node:path';
const call = async (name, args) => {
  const response = await fetch('http://127.0.0.1:18755/tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }) });
  const result = await response.json(); if (!response.ok || result.isError) throw Error(JSON.stringify(result)); return result;
};
const result = await call('list_stashdock_shelf', { query: 'Canonical note' });
const notes = result._meta.items.filter(item => /^Canonical note (light|dark)$/.test(item.title));
if (notes.length !== 2) throw Error('Expected exactly two owned fixture notes.');
for (const note of notes) {
  const file = await call('get_stashdock_file', { id: note.id }), path = realpathSync(file.structuredContent.path);
  const child = relative(realpathSync(tmpdir()), path);
  if (isAbsolute(child) || child.startsWith('..') || !child.split(sep)[0].startsWith('stashdock-mcp-test-canonical-note-') || !path.endsWith('.txt')) throw Error('Refusing a non-fixture file.');
  const replacement = path + '.fixture-save';
  writeFileSync(replacement, 'externallyChangedUniquePhrase\n外部编辑已保存\n', { encoding: 'utf8', flag: 'wx' });
  renameSync(replacement, path);
}
console.log(JSON.stringify({ originalsEditedIndependently: notes.length, atomicSave: true, realLibraryWrites: 0 }));
