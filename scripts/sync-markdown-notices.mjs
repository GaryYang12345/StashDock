// Retain upstream notices for every package actually bundled in the preview.
import { build } from 'esbuild';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeIfChanged } from './lib/write-if-changed.mjs';

const root = resolve(import.meta.dirname, '..');
const result = await build({ entryPoints: [resolve(root, 'src/components/MarkdownPreview.tsx')], bundle: true, write: false, metafile: true, format: 'esm', jsx: 'automatic', loader: { '.module.css': 'empty' }, external: ['react', 'react/jsx-runtime'] });
const packages = new Set(Object.keys(result.metafile.inputs).filter(input => input.includes('node_modules')).map(input => {
  const parts = input.replaceAll('\\', '/').split('node_modules/').at(-1).split('/');
  return parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/');
}));
const destination = resolve(root, 'public/licenses/markdown');
await mkdir(destination, { recursive: true });
for (const name of [...packages].sort()) {
  const folder = resolve(root, 'node_modules', name);
  const files = (await readdir(folder)).filter(file => /^(?:licen[cs]e|copying|notice)(?:[.-]|$)/i.test(file));
  if (!files.length) throw Error(`Missing Markdown dependency license: ${name}`);
  for (const file of files) await writeIfChanged(resolve(destination, `${name.replaceAll('/', '_')}--${file}`), await readFile(resolve(folder, file)));
}
console.log(`Retained Markdown notices for ${packages.size} bundled packages.`);
