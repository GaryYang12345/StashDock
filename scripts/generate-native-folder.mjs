// Reuse the approved React artwork as a build asset, never a second drawing.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeIfChanged } from './lib/write-if-changed.mjs';
import { themes } from './generate-native-search.mjs';
const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'assets/generated'), { recursive: true });
for (const layer of [undefined, 'rear', 'cards', 'front']) {
  const compiled = await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {FolderArtwork} from './src/components/FolderArtwork';module.exports=renderToStaticMarkup(<FolderArtwork nativeClose layer={${JSON.stringify(layer) || 'undefined'}}/>);`, loader: 'tsx', resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.svg': 'dataurl' } });
  const result = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), result, result.exports);
  const svg = result.exports.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  await writeIfChanged(resolve(root, `assets/generated/folder-native${layer ? '-' + layer : ''}.svg`), svg);
}
// The native accessory uses the same curated reference icons as the shelf.
const compiledIcons = await build({ stdin: { contents: "import { referenceIcons } from './src/generated/reference-icons';module.exports=referenceIcons;", resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node' });
const icons = { exports: {} };
new Function('module', 'exports', compiledIcons.outputFiles[0].text)(icons, icons.exports);
const actions = await build({ stdin:{ contents:"import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {Search,X,Copy,Check} from 'lucide-react';module.exports=(color)=>Object.fromEntries(Object.entries({search:Search,clear:X,copy:Copy,check:Check}).map(([name,Icon])=>[name,renderToStaticMarkup(React.createElement(Icon,{color,strokeWidth:name==='copy'||name==='check'?1.75:2}))]));", resolveDir:root }, bundle:true, write:false, format:'cjs', platform:'node' });
const actionModule = {exports:{}};
new Function('require','module','exports',actions.outputFiles[0].text)(createRequire(import.meta.url),actionModule,actionModule.exports);
for (const [theme, colors] of Object.entries(themes)) for (const role of ['foreground','text-muted','background']) {
  const color = `rgb(${colors[role].map(v=>Math.round(v*255)).join(',')})`;
  for (const [name, svg] of Object.entries(actionModule.exports(color))) icons.exports[`control_${theme}_${role}_${name}`] = {width:24,height:24,body:`<g fill="none" stroke="${color}" stroke-width="${name==='copy'||name==='check'?1.75:2}" stroke-linecap="round" stroke-linejoin="round">${svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'))}</g>`};
}
await writeIfChanged(resolve(root, 'assets/generated/native-reference-icons.json'), JSON.stringify(icons.exports));
