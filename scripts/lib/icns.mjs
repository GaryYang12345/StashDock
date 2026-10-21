// Tauri emits its unchanged image representations in nondeterministic map order.
// Canonicalize the container only, keeping legacy color/alpha pairs adjacent.
const order = ['is32','s8mk','il32','l8mk','ic07','ic08','ic09','ic10','ic11','ic12','ic13','ic14'];
export function canonicalIcns(bytes) {
  if (bytes.length<8 || bytes.toString('ascii',0,4)!=='icns' || bytes.readUInt32BE(4)!==bytes.length) throw Error('Invalid ICNS header.');
  const chunks=new Map();
  let cursor=8;
  while(cursor<bytes.length){
    if(cursor+8>bytes.length) throw Error('Incomplete ICNS chunk.');
    const tag=bytes.toString('ascii',cursor,cursor+4), length=bytes.readUInt32BE(cursor+4);
    if(length<8 || cursor+length>bytes.length || chunks.has(tag) || !order.includes(tag)) throw Error('Review changed ICNS representation format.');
    chunks.set(tag,bytes.subarray(cursor,cursor+length));cursor+=length;
  }
  if(!chunks.size) throw Error('Empty ICNS.');
  return Buffer.concat([bytes.subarray(0,8),...order.filter(tag=>chunks.has(tag)).map(tag=>chunks.get(tag))]);
}
