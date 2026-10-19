import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIfChanged } from './lib/write-if-changed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  web: ['flat-color-icons', 'globe'],
  repo: ['vscode-icons', 'file-type-git2'],
  note: ['flat-color-icons', 'todo-list'],
  pdf: ['vscode-icons', 'file-type-pdf2'],
  document: ['vscode-icons', 'file-type-word2'],
  spreadsheet: ['vscode-icons', 'file-type-excel2'],
  presentation: ['vscode-icons', 'file-type-powerpoint2'],
  archive: ['flat-color-icons', 'package'],
  video: ['flat-color-icons', 'clapperboard'],
  audio: ['flat-color-icons', 'music'],
  code: ['flat-color-icons', 'command-line'],
  text: ['vscode-icons', 'file-type-text'],
  markdown: ['vscode-icons', 'file-type-markdown'],
  data: ['vscode-icons', 'file-type-json'],
  image: ['flat-color-icons', 'image-file'],
  file: ['flat-color-icons', 'file'],
};
const icons = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([kind, [set, name]]) => {
  const module = await import(`@iconify-icons/${set}/${name}`);
  return [kind, module.default];
})));
const target = resolve(root, 'src/generated/reference-icons.ts');
await mkdir(dirname(target), { recursive: true });
await writeIfChanged(target, `// Generated from MIT-licensed vscode-icons and Icons8 Flat Color Icons. Do not edit by hand.\nimport type { IconifyIcon } from '@iconify/react/offline';\n\nexport const referenceIcons = ${JSON.stringify(icons, null, 2)} as const satisfies Record<string, IconifyIcon>;\n`);
await writeIfChanged(resolve(root, 'public/licenses/IconifyReact-MIT.txt'), await readFile(resolve(root, 'node_modules/@iconify/react/license.txt')));
console.log(`Generated ${Object.keys(icons).length} offline reference icons.`);
