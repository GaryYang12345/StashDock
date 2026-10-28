// Platform launch artwork and transparent inline brand marks have distinct owners.
import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { writeIfChanged } from './lib/write-if-changed.mjs';

const root = resolve(import.meta.dirname, '..');
function run(command, args) {
  const child = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (child.error) throw child.error;
  if (child.status !== 0) throw Error(`${command} failed (${child.status}).`);
}
if (process.platform === 'win32') {
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/generate-icon.ps1']);
} else if (process.platform === 'darwin') {
  // The shared icon generator owns the static Mac compatibility composition.
  // Icon Composer is a separate release task; an ICNS is not Liquid Glass.
  const destination = join(root, 'src-tauri/icons/macos');
  await mkdir(destination, { recursive: true });
  await copyFile(join(root, 'assets/app-icon/app-icon.icns'), join(destination, 'icon.icns'));
  // Match the existing Windows favicon transformation byte for byte.
  const svg = (await readFile(join(root, 'assets/brand/icon.svg'), 'utf8'))
    .replaceAll('fill="black"', 'fill="currentColor"')
    .replaceAll('<path ', '<style>:root{color:#161616}@media(prefers-color-scheme:dark){:root{color:#f5f5f5}}</style><path ');
  await mkdir(join(root, 'assets/generated'), { recursive: true });
  await writeIfChanged(join(root, 'assets/generated/favicon.svg'), svg);
} else {
  throw Error('Brand generation is supported on Windows and macOS.');
}
