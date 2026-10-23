import { realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, sep } from 'node:path';
import { spawn } from 'node:child_process';

const supported = new Set(['.pdf','.png','.jpg','.jpeg','.gif','.webp','.svg','.avif','.heic','.txt','.md','.mdx','.csv','.json','.log','.doc','.docx','.odt','.rtf','.xls','.xlsx','.ods','.ppt','.pptx','.odp','.zip','.mp3','.wav','.m4a','.ogg','.flac','.mp4','.mov','.webm','.avi']);

export function resolveManagedFile(raw, assets) {
  if (typeof raw !== 'string') throw Error('The saved file was not found.');
  let root, path, stat;
  try { root = realpathSync(assets); path = realpathSync(raw); stat = statSync(path); }
  catch { throw Error('The saved file is unavailable. Restore it before using this reference.'); }
  const child = relative(root, path);
  if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child) || !stat.isFile()) throw Error('Only saved managed files can be accessed.');
  return { path, sizeBytes: stat.size };
}

export async function openManagedFile(raw, assets, options) {
  return openFilePath(resolveManagedFile(raw, assets).path, options);
}

/** Opens an already validated reference file (managed backup or its original). */
export async function openFilePath(path, { launch = spawn, platform = process.platform } = {}) {
  if (!supported.has(extname(path).toLowerCase())) throw Error('Open this file type from your file manager.');
  const [command, args] = platform === 'win32' ? ['explorer.exe', [path]] : platform === 'darwin' ? ['open', [path]] : ['xdg-open', [path]];
  await new Promise((resolve, reject) => {
    const child = launch(command, args, { shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', () => reject(Error('This file could not be opened. Check that its app is installed and the file still exists.')));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  return { opened: true };
}
