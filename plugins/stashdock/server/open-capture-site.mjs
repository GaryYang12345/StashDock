import { spawn } from 'node:child_process';
import { captureSites, customCapturePlatform } from '../../../src/lib/captureSites.ts';

// Launch the OS default browser. Never attach it to a renderer-owned job,
// supply a fresh profile, read its cookies or expose arbitrary URL execution.
export async function openCaptureSite(site, { launch = spawn, platform = process.platform, customPlatforms = [] } = {}) {
  const destination = [...captureSites, ...customPlatforms].find(value => value.id === site);
  if (!destination) throw Error('Choose a supported capture site.');
  const url = customCapturePlatform(destination.url).url;
  const [command, args] = platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  await new Promise((resolve, reject) => {
    const child = launch(command, args, { shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', () => reject(Error('Your browser could not be opened. Open the website in your browser and use the StashDock extension.')));
    child.once('exit', code => { if (code !== 0) reject(Error('Your default browser could not be opened.')); });
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  return { opened: true };
}
