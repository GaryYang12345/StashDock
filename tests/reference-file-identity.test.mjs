import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

test('shared web forms and native search use the same original filename and MIME classification', async () => {
  const compiled = await build({ entryPoints:['src/lib/fileReference.ts'], bundle:true, write:false, format:'cjs', platform:'node' });
  const module = { exports:{} };
  new Function('module','exports',compiled.outputFiles[0].text)(module,module.exports);
  for (const fixture of JSON.parse(readFileSync('tests/fixtures/reference-file-types.json','utf8'))) {
    const item = {kind:fixture.kind,title:'User edited title',origin:{fileName:fixture.name},mimeType:fixture.mime};
    assert.equal(module.exports.fileReferenceType(item).visual,fixture.visual,JSON.stringify(fixture));
  }
});
