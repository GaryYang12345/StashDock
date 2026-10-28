import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function registerBrowserHost(env = process.env, platform = process.platform, run = execFileSync) {
  if (!['win32','darwin'].includes(platform) || env.STASHDOCK_NATIVE_HOST_REGISTRATION === 'off') return;
  try {
    run(fileURLToPath(new URL(platform === 'darwin' ? `../bin/darwin-${process.arch}/stashdock-browser` : '../bin/win32-x64/stashdock-browser.exe', import.meta.url)), ['--register','plugin'], {env,windowsHide:true,timeout:5000,stdio:['ignore','ignore','pipe']});
  } catch { process.stderr.write('StashDock browser save component registration failed. Reinstall the latest plugin.\n'); }
}
