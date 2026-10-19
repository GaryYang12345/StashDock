// Read-only installed-host inspection. Never invokes host IPC or changes its files.
import fs from 'node:fs';
const archive=process.argv[2];
const file=fs.openSync(archive,'r');
const first=Buffer.alloc(16);fs.readSync(file,first,0,16,0);
const headerSize=first.readUInt32LE(4),jsonSize=first.readUInt32LE(12);
if(jsonSize>20_000_000||headerSize<jsonSize)throw Error('Unexpected ASAR header');
const bytes=Buffer.alloc(jsonSize);fs.readSync(file,bytes,0,jsonSize,16);
const root=JSON.parse(bytes.toString());
const entries=[];
function walk(node,prefix='') {for(const [name,entry] of Object.entries(node.files||{})) {
  const path=prefix+name;if(entry.files)walk(entry,path+'/');else entries.push({path,...entry});
}}
walk(root);
if(!process.argv[3])console.log(entries.filter(e=>/preload|drag|composer|attachment/.test(e.path)).map(e=>e.path).join('\n'));
else if(process.argv[3]==='--find') {
  for(const entry of entries.filter(e=>!e.unpacked&&e.path.endsWith('.js'))) {
    const content=Buffer.alloc(entry.size);fs.readSync(file,content,0,content.length,8+headerSize+Number(entry.offset));
    const source=content.toString();const found=process.argv.slice(4).filter(n=>source.includes(n));
    if(found.length)console.log(JSON.stringify({path:entry.path,found}));
  }
}
else {
  const match=entries.find(e=>e.path===process.argv[3]);if(!match||match.unpacked)throw Error('Packed entry missing');
  const content=Buffer.alloc(match.size);fs.readSync(file,content,0,content.length,8+headerSize+Number(match.offset));
  const source=content.toString();
  for(const needle of process.argv.slice(4)) {
    let at=-1,count=0;
    while((at=source.indexOf(needle,at+1))>=0 && count++<12)console.log(JSON.stringify({needle,offset:at,code:source.slice(Math.max(0,at-350),at+950)}));
  }
}
fs.closeSync(file);
