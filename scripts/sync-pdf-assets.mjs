// Build inputs only. The PDF parser is embedded in both native binaries, not fetched at runtime.
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { writeIfChanged } from './lib/write-if-changed.mjs';
const folder = resolve('src-tauri/pdf-runtime');
await mkdir(folder, { recursive: true });
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) await writeIfChanged(resolve(folder, file), await readFile(resolve('node_modules/pdfjs-dist/build', file)));
const result = await build({ stdin: { contents: "import * as parser from 'pdfjs-dist/build/pdf.mjs'; import * as worker from 'pdfjs-dist/build/pdf.worker.mjs'; globalThis.pdfjsWorker=worker; export const getDocument=parser.getDocument;", resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'iife', globalName: 'StashDockPdf', minify: true, write: false });
await writeIfChanged(resolve(folder, 'pdf-bundle.js'), result.outputFiles[0].contents);
await writeIfChanged(resolve(folder, 'LICENSE'), await readFile(resolve('node_modules/pdfjs-dist/LICENSE')));
