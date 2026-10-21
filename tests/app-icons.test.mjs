import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalIcns } from '../scripts/lib/icns.mjs';
const read = file => readFileSync('assets/app-icon/'+file);
const paths = svg => [...svg.matchAll(/\bd="([^"]+)"/g)].map(match=>match[1]);
test('app icon compositions preserve the supplied vector geometry and use a square canvas', () => {
  const source = readFileSync('assets/brand/icon.svg','utf8').replaceAll('\r\n','\n');
  const geometry = paths(source);
  for (const file of ['app-icon.svg','app-icon-dark.svg','windows.svg','macos-fallback.svg','apple/02-mark.svg','apple/02-mark-dark.svg']) {
    const icon = read(file).toString();
    assert.deepEqual(paths(icon),geometry,file);
    assert.match(icon,/viewBox="0 0 1024 1024"/);
  }
  assert.equal(JSON.parse(read('composition.json')).sourceSha256,createHash('sha256').update(source).digest('hex'));
  for (const file of ['app-icon-1024.png','app-icon-dark-1024.png']) {
    const png=read(file); assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);
  }
});
test('Apple layers are unmasked and effect-free; native Liquid Glass verification is not fabricated', () => {
  for (const file of ['apple/02-mark.svg','apple/02-mark-dark.svg']) assert.doesNotMatch(read(file).toString(),/<rect|filter|mask|clipPath|gradient|opacity|shadow/i);
  assert.match(read('apple/01-background.svg').toString(),/<rect width="1024" height="1024" fill="white"/);
  const spec=JSON.parse(read('composition.json'));
  assert.equal(spec.apple.layersUnmasked,true);assert.equal(spec.apple.bakedEffects,false);
  assert.equal(spec.apple.composerFileCreated,false);assert.equal(spec.apple.nativeLiquidGlassVerified,false);
});

test('Windows removes the outer gutter by scaling the whole approved composition', () => {
  const spec=JSON.parse(read('composition.json'));
  assert.equal(spec.mark.width,640); // Do not change the approved inner spacing.
  assert.equal(spec.windows.outsideGutter,0);
  assert.equal(spec.windows.compositionScale,1024/928);
  assert.equal(spec.windows.plateToMarkRatioUnchanged,true);
  const icon=read('windows.svg').toString();
  assert.ok(icon.includes(`translate(512 512) scale(${1024/928}) translate(-512 -512)`));
  assert.match(icon, /<rect x="48" y="48" width="928" height="928" rx="208"/);
  const ico=read('app-icon.ico');
  const sizes=[16,20,24,30,32,36,40,48,60,64,72,80,96,128,256];
  assert.equal(ico.readUInt16LE(4),sizes.length);
  for (const [index,size] of sizes.entries()) {
    assert.equal(ico[6+index*16] || 256,size);
    const png=read(`windows/${size}.png`);
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
  }
});
test('macOS compatibility ICNS contains a real 1024px PNG representation', () => {
  const icns=read('app-icon.icns');
  assert.equal(icns.toString('ascii',0,4),'icns');assert.equal(icns.readUInt32BE(4),icns.length);
  let cursor=8, largest=false;
  while(cursor<icns.length){
    const length=icns.readUInt32BE(cursor+4);assert.ok(length>=8&&cursor+length<=icns.length);
    if(icns.toString('ascii',cursor,cursor+4)==='ic10'){
      const png=icns.subarray(cursor+8,cursor+length);assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);largest=true;
    }
    cursor+=length;
  }
  assert.equal(cursor,icns.length);assert.ok(largest);
});
test('ICNS canonical order preserves image bytes, pairs and identical subsequent exports', () => {
  const icns=read('app-icon.icns'), chunks=[];
  for(let cursor=8;cursor<icns.length;){const length=icns.readUInt32BE(cursor+4);chunks.push(icns.subarray(cursor,cursor+length));cursor+=length;}
  assert.deepEqual(canonicalIcns(Buffer.concat([icns.subarray(0,8),...chunks.reverse()])),icns);
  assert.deepEqual(canonicalIcns(icns),icns);
  assert.throws(()=>canonicalIcns(icns.subarray(0,icns.length-1)),/header/);
});
