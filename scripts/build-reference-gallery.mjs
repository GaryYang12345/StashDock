// Standalone acceptance artifact; never a production route or library seed.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
const result=await build({configFile:false,root:process.cwd(),plugins:[react()],build:{write:false,assetsInlineLimit:Number.MAX_SAFE_INTEGER,cssCodeSplit:false,rollupOptions:{input:'tests/fixtures/reference-visuals.html',output:{inlineDynamicImports:true}}}});
const output=result.output,js=output.find(asset=>asset.type==='chunk'&&asset.isEntry)?.code;
const css=output.filter(asset=>asset.type==='asset'&&asset.fileName.endsWith('.css')).map(asset=>asset.source).join('\n');
if(!js)throw Error('Gallery entry was not generated.');
await mkdir('output/visual-gallery',{recursive:true});
await writeFile('output/visual-gallery/index.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StashDock reference styles</title><style>${css.replace(/<\/style/gi,'<\\/style')}</style></head><body><div id="root"></div><script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
console.log('Standalone visual specimen: output/visual-gallery/index.html');
