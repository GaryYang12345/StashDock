// One source tree. Generate host-specific manifests, never fork capture/UI code.
import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import productLinks from '../src-tauri/product-links.json' with { type: 'json' };

export function browserManifest(base, browser) {
  if (!['chrome', 'edge', 'firefox'].includes(browser)) throw Error('Unsupported browser build.');
  const manifest = structuredClone(base);
  if (browser === 'firefox') {
    delete manifest.minimum_chrome_version;
    delete manifest.side_panel;
    manifest.permissions = manifest.permissions.filter(value => value !== 'sidePanel');
    manifest.background = { scripts: ['background.js'], type: 'module' };
    manifest.sidebar_action = { default_panel: 'sidepanel.html', default_title: manifest.name, default_icon: manifest.icons, open_at_install: false };
    manifest.browser_specific_settings = { gecko: { id: productLinks.browserExtensions.firefox.id, strict_min_version: productLinks.browserExtensions.firefox.minimumVersion,
      data_collection_permissions: { required: ['websiteContent', 'browsingActivity'] } } };
  }
  return manifest;
}

export async function buildExtensions() {
  const root = resolve(import.meta.dirname, '..'), source = join(root, 'extension');
  const destination = join(root, 'output', 'extensions');
  const base = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  const files = (await readdir(source)).filter(name => name !== 'manifest.json' && name !== 'README.md');
  for (const browser of ['chrome']) {
    const directory = join(destination, browser);
    if (!directory.startsWith(destination + sep)) throw Error('Invalid generated package directory.');
    // Only the three named generated directories, never source or user profiles.
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    for (const file of files) await cp(join(source, file), join(directory, file), { recursive: true });
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(browserManifest(base, browser), null, 2) + '\n');
    console.log(`${browser}: ${directory}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildExtensions();
