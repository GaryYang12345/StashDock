// Read the PE resource directory directly. Shell icon extraction is cached and
// cannot prove which artwork is actually embedded in the released executable.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = resolve(process.argv[2] || resolve(root, 'stashdock.exe'));
const pe = await readFile(executable);
const ico = await readFile(resolve(root, 'src-tauri/icons/icon.ico'));
const header = pe.readUInt32LE(0x3c);
assert.equal(pe.toString('ascii', header, header + 4), 'PE\0\0');
const optional = header + 24;
const directories = optional + (pe.readUInt16LE(optional) === 0x20b ? 112 : 96);
const resourceRva = pe.readUInt32LE(directories + 16);
const sectionTable = optional + pe.readUInt16LE(header + 20);
const sections = Array.from({length:pe.readUInt16LE(header + 6)}, (_, index) => {
  const offset = sectionTable + 40 * index;
  return {rva:pe.readUInt32LE(offset + 12),size:Math.max(pe.readUInt32LE(offset + 8),pe.readUInt32LE(offset + 16)),offset:pe.readUInt32LE(offset + 20)};
});
function fileOffset(rva) {
  const section = sections.find(section=>rva>=section.rva&&rva<section.rva+section.size);
  assert.ok(section, 'Resource RVA outside PE sections');
  return section.offset + rva - section.rva;
}
const resourceBase = fileOffset(resourceRva);
const resources = [];
function walk(relative, path = []) {
  assert.ok(path.length < 4, 'Unexpected resource directory nesting');
  const dir = resourceBase + relative;
  const count = pe.readUInt16LE(dir + 12) + pe.readUInt16LE(dir + 14);
  for (let i = 0; i < count; i++) {
    const entry = dir + 16 + 8 * i;
    const rawName = pe.readUInt32LE(entry);
    const nameOffset = resourceBase + (rawName & 0x7fffffff);
    const name = rawName & 0x80000000 ? pe.toString('utf16le', nameOffset + 2, nameOffset + 2 + pe.readUInt16LE(nameOffset) * 2) : rawName;
    const target = pe.readUInt32LE(entry + 4);
    if (target & 0x80000000) walk(target & 0x7fffffff, [...path, name]);
    else {
      const dataEntry = resourceBase + target;
      const dataOffset = fileOffset(pe.readUInt32LE(dataEntry));
      resources.push({path:[...path,name],data:pe.subarray(dataOffset,dataOffset+pe.readUInt32LE(dataEntry+4))});
    }
  }
}
walk(0);
const expected = Array.from({length:ico.readUInt16LE(4)}, (_, index) => {
  const offset = 6 + index * 16;
  return {size:ico[offset] || 256,data:ico.subarray(ico.readUInt32LE(offset+12),ico.readUInt32LE(offset+12)+ico.readUInt32LE(offset+8))};
});
const groups = resources.filter(resource=>resource.path[0]===14);
assert.ok(groups.length, 'No icon group in executable');
const result = groups.map(group => {
  const count = group.data.readUInt16LE(4);
  const sizes = [];
  let matches = count === expected.length;
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 14;
    const size = group.data[offset] || 256;
    const imageId = group.data.readUInt16LE(offset + 12);
    const image = resources.find(resource=>resource.path[0]===3&&resource.path[1]===imageId&&resource.path[2]===group.path[2]);
    const target = expected.find(entry=>entry.size===size);
    sizes.push(size);
    matches &&= !!image && !!target && image.data.equals(target.data);
  }
  return {id:group.path[1],language:group.path[2],sizes,matchesBrand:matches};
});
console.log(JSON.stringify({executable,groups:result},null,2));
assert.ok(result.every(group=>group.matchesBrand), 'Executable icon resources do not match the current brand ICO');
