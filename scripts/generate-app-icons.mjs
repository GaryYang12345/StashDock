// Compose the supplied vector mark, never redraw it. No browser or design account needed.
import { readFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { writeIfChanged } from './lib/write-if-changed.mjs';
import { canonicalIcns } from './lib/icns.mjs';

const root = resolve(import.meta.dirname, '..');
const destination = join(root, 'assets/app-icon');
const original = (await readFile(join(root, 'assets/brand/icon.svg'), 'utf8')).replaceAll('\r\n','\n');
const paths = [...original.matchAll(/<path\b[^>]*\/>/g)].map(match => match[0]);
if (paths.length !== 1 || !original.includes('viewBox="0 0 684 545"')) throw Error('Review changed brand geometry before exporting.');
const size = 1024, markWidth = 640, scale = markWidth / 684;
const transform = `translate(${(size-markWidth)/2} ${(size-545*scale)/2}) scale(${scale})`;
const mark = ink => `<g transform="${transform}">${paths[0].replace('fill="black"', `fill="${ink}"`)}</g>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>\n`;
const light = `<rect width="1024" height="1024" fill="white"/>${mark('black')}`;
// Crop only the outside transparent gutter. Scale the approved plate + mark
// together, preserving their relative size, centering and corner proportions.
const windowsScale = size / 928;
const windowsArtwork = `<rect x="48" y="48" width="928" height="928" rx="208" fill="white"/>${mark('black')}`;
const sources = {
  'app-icon.svg': svg(light),
  'app-icon-dark.svg': svg(`<rect width="1024" height="1024" fill="#202124"/>${mark('white')}`),
  'windows.svg': svg(`<g transform="translate(512 512) scale(${windowsScale}) translate(-512 -512)">${windowsArtwork}</g>`),
  // A static compatibility export, not the input to Icon Composer.
  'macos-fallback.svg': svg(`<defs><clipPath id="tile"><rect x="96" y="96" width="832" height="832" rx="184"/></clipPath></defs><g clip-path="url(#tile)"><g transform="translate(96 96) scale(0.8125)">${light}</g></g>`),
  'apple/02-mark.svg': svg(mark('black')),
  'apple/02-mark-dark.svg': svg(mark('white')),
  'apple/01-background.svg': svg('<rect width="1024" height="1024" fill="white"/>'),
};
for (const [name, contents] of Object.entries(sources)) {
  await mkdir(dirname(join(destination, name)), { recursive:true });
  await writeIfChanged(join(destination, name), contents);
}
const spec = {
  formatVersion:1, source:'../brand/icon.svg', sourceSha256:createHash('sha256').update(original).digest('hex'),
  canvas:{width:size,height:size,colorSpace:'sRGB'}, mark:{width:markWidth,transform,geometryUnchanged:true},
  windows:{outsideGutter:0,compositionScale:windowsScale,plateToMarkRatioUnchanged:true},
  apple:{background:'white',foreground:'apple/02-mark.svg',darkForeground:'apple/02-mark-dark.svg',
    layersUnmasked:true,bakedEffects:false,composerFileCreated:false,nativeLiquidGlassVerified:false},
};
await writeIfChanged(join(destination,'composition.json'),JSON.stringify(spec,null,2)+'\n');

const temp = await mkdtemp(join(tmpdir(),'stashdock-app-icon-'));
const cli = join(root,'node_modules/@tauri-apps/cli/tauri.js');
function render(input, folder, sizes) {
  const result = spawnSync(process.execPath,[cli,'icon',join(destination,input),'--output',join(temp,folder),
    ...(sizes ? sizes.flatMap(value=>['--png',String(value)]) : [])],{cwd:root,encoding:'utf8',windowsHide:true});
  if (result.status !== 0) throw Error(result.stderr || result.stdout || 'Tauri icon export failed.');
}
const sizes = [16,20,24,30,32,36,40,48,60,64,72,80,96,128,256];
try {
  render('windows.svg','windows',sizes);
  render('app-icon.svg','master',[1024]);
  render('app-icon-dark.svg','dark',[1024]);
  render('macos-fallback.svg','macos');
  const windows = new Map();
  for (const item of await readdir(join(temp,'windows'))) {
    if (!item.endsWith('.png')) continue;
    const bytes = await readFile(join(temp,'windows',item));
    windows.set(bytes.readUInt32BE(16),bytes);
  }
  await mkdir(join(destination,'windows'),{recursive:true});
  for (const value of sizes) {
    const bytes = windows.get(value);
    if (!bytes) throw Error(`Missing ${value}px Windows export.`);
    await writeIfChanged(join(destination,`windows/${value}.png`),bytes);
  }
  const master = (await readdir(join(temp,'master'))).find(name=>name.endsWith('.png'));
  const dark = (await readdir(join(temp,'dark'))).find(name=>name.endsWith('.png'));
  await writeIfChanged(join(destination,'app-icon-1024.png'),await readFile(join(temp,'master',master)));
  await writeIfChanged(join(destination,'app-icon-dark-1024.png'),await readFile(join(temp,'dark',dark)));
  await writeIfChanged(join(destination,'app-icon.icns'),canonicalIcns(await readFile(join(temp,'macos/icon.icns'))));
  const body = sources['windows.svg'].replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  const samples = [16,24,32,48,64,128].map((value,index)=>{
    const x=104+index*160;
    return `<image x="${x-value/2}" y="${788-value/2}" width="${value}" height="${value}" href="data:image/png;base64,${windows.get(value).toString('base64')}"/>`;
  }).join('');
  // Presentation only: two contexts and actual small-size raster exports.
  await writeIfChanged(join(destination,'preview.svg'),svg(`<rect width="1024" height="1024" fill="#f4f4f6"/><rect x="48" y="160" width="440" height="440" rx="32" fill="#e4e4e8"/><rect x="536" y="160" width="440" height="440" rx="32" fill="#242426"/><g transform="translate(104 216) scale(0.32)">${body}</g><g transform="translate(592 216) scale(0.32)">${body}</g>${samples}`));
  render('preview.svg','preview',[1024]);
  const preview = (await readdir(join(temp,'preview'))).find(name=>name.endsWith('.png'));
  await writeIfChanged(join(destination,'preview.png'),await readFile(join(temp,'preview',preview)));
  const directory = Buffer.alloc(6+sizes.length*16);
  directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
  let offset = directory.length;
  for (const [index,value] of sizes.entries()) {
    const entry = 6+index*16, bytes = windows.get(value);
    directory[entry] = value===256?0:value;directory[entry+1]=directory[entry];
    directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
    directory.writeUInt32LE(bytes.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=bytes.length;
  }
  const ico = Buffer.concat([directory,...sizes.map(value=>windows.get(value))]);
  await writeIfChanged(join(destination,'app-icon.ico'),ico);
  for (const [name,bytes] of [['icon.ico',ico],['icon.png',windows.get(256)],['128x128.png',windows.get(128)]]) {
    await writeIfChanged(join(root,'src-tauri/icons',name),bytes);
  }
  console.log(JSON.stringify({appIcon:destination,windowsSizes:sizes,appleCanvas:1024,originalGeometryPreserved:true,nativeLiquidGlassVerified:false}));
} finally {
  const within = relative(resolve(tmpdir()),resolve(temp));
  if (within && !within.startsWith('..') && !isAbsolute(within) && within.startsWith('stashdock-app-icon-')) await rm(temp,{recursive:true,force:true});
}
