// Real public reads and isolated renders only. No library writes.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { runPreviewHelper } from '../plugins/stashdock/server/preview-worker.mjs';
const helper = resolve('src-tauri/target/release/stashdock-preview.exe');
const targets = process.argv.includes('--web-only') ? ['https://spektralab.app/'] : ['https://arxiv.org/pdf/2505.22954', 'https://spektralab.app/'];
await mkdir('output/playwright', { recursive: true });
for (const [index, url] of targets.entries()) {
  const result = await new Promise((done, fail) => {
    const child = spawn(helper, [], { windowsHide: true, env: { ...process.env, STASHDOCK_PREVIEW_DIAGNOSTICS: '1' } });
    let output='', diagnostics='';
    const timer = setTimeout(() => { child.kill(); fail(Error('Lookup exceeded deadline')); }, 55_000);
    child.stdout.on('data', data => output += data); child.stderr.on('data', data => diagnostics += data);
    child.on('error', fail); child.on('close', () => { clearTimeout(timer); done({data:JSON.parse(output),diagnostics}); });
    child.stdin.end(JSON.stringify({url,lookup:true}));
  });
  await writeFile(`output/playwright/reported-link-${index}-diagnostics.txt`, result.diagnostics);
  console.log(JSON.stringify({url,mode:'native-lookup',title:result.data.title,characters:result.data.content?.length,previewBytes:result.data.preview?.length,error:result.data.error,diagnostics:result.diagnostics.slice(0,1000)}));
  assert.ok(!result.data.error && result.data.title && result.data.content, 'Real lookup failed');
  if(url.includes('arxiv.org')) {
    assert.match(result.data.title,/Darwin|G[oö]del/i);
    assert.ok(result.data.preview?.startsWith('data:image/jpeg;base64,'));
    await writeFile('output/playwright/arxiv-pdf-first-page-0416.jpg',Buffer.from(result.data.preview.split(',')[1],'base64'));
  }
  for(let attempt=0;attempt<3;attempt++) {
    const data=await runPreviewHelper(helper,{url});
    console.log(JSON.stringify({url,mode:'background-preview',attempt,kind:data.previewKind,bytes:data.preview?.length,error:data.error}));
    assert.ok(data.preview, 'Reported link has no preview');
    await writeFile(`output/playwright/reported-preview-${index}-0416.jpg`,Buffer.from(data.preview.split(',')[1],'base64'));
  }
}
