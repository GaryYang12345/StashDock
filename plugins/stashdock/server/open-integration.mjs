import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statSync } from 'node:fs';
import { win32 } from 'node:path';
import productLinks from '../../../src-tauri/product-links.json' with { type: 'json' };

const exec = promisify(execFile);
export function githubRepositoryUrl(repository = productLinks.githubRepository) {
  return typeof repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repository) && repository.split('/').every(part => !['.', '..'].includes(part)) ? `https://github.com/${repository}` : null;
}
async function registry(key, value) {
  try { return (await exec('reg.exe', ['query', key, ...(value === undefined ? [] : value === '' ? ['/ve'] : ['/v', value])], { windowsHide: true, timeout: 1500, maxBuffer: 16384 })).stdout; }
  catch { return null; }
}
function executable(path, name, file = value => statSync(value).isFile()) {
  try { return typeof path === 'string' && win32.isAbsolute(path) && win32.basename(path).toLowerCase() === name && file(path) ? path : null; } catch { return null; }
}
export async function integrationDestination(id, { platform = process.platform, readRegistry = registry, desktopPath, file } = {}) {
  if (!Object.hasOwn(productLinks.applications, id)) throw Error('Choose a supported StashDock app.');
  const target = productLinks.applications[id];
  if (platform === 'win32') {
    if (id === 'desktop') {
      const path = executable(desktopPath, 'stashdock.exe', file);
      if (path) return { target: path, fallback: target.website };
    }
    for (const scheme of target.protocols || []) {
      if (await readRegistry(`HKCR\\${scheme}\\shell\\open\\command`) !== null) return { target: `${scheme}://`, fallback: target.website };
    }
    if (target.executable) for (const root of ['HKCU', 'HKLM']) {
      const raw = await readRegistry(`${root}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${target.executable}`, '');
      const path = raw?.match(/REG_(?:EXPAND_)?SZ\s+(.+)/)?.[1]?.trim().replace(/^"|"$/g, '').replace(/%([^%]+)%/g, (match, key) => process.env[key] || match);
      const valid = executable(path, target.executable, file);
      if (valid) return { target: valid, fallback: target.website };
    }
  }
  const fallback = target.website || (id === 'desktop' ? productLinks.installationUrls.desktop || githubRepositoryUrl() : null);
  if (!fallback) throw Error('The StashDock Desktop download link is not available yet.');
  return { target: fallback, fallback: null };
}
export async function openIntegration(id, { desktopPath, platform = process.platform, launch = spawn, ...options } = {}) {
  const destination = await integrationDestination(id, { desktopPath, platform, ...options });
  const open = target => new Promise((resolve, reject) => {
    const [command, args] = platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', target]] : platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]];
    const child = launch(command, args, { shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  try { await open(destination.target); } catch { if (destination.fallback) await open(destination.fallback); else throw Error('The app could not be opened. Try again.'); }
  return { opened: true };
}
