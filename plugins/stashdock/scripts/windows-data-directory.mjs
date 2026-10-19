import { execFileSync } from 'node:child_process';

// Hosts already running when a user sets STASHDOCK_DATA_DIR keep an old
// environment. Match the desktop launcher without hard-coding a local drive.
export function restoreWindowsDataDirectory(env = process.env, platform = process.platform, query = execFileSync) {
  if (platform !== 'win32' || env.STASHDOCK_DATA_DIR) return;
  try {
    const output = query('reg.exe', ['query', 'HKCU\\Environment', '/v', 'STASHDOCK_DATA_DIR'],
      { encoding: 'utf8', windowsHide: true, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] });
    const value = output.match(/^\s*STASHDOCK_DATA_DIR\s+REG_(?:EXPAND_)?SZ\s+(.+)$/m)?.[1]?.trim();
    // No shell evaluation or expansion of unresolved registry variables.
    if (value && !value.includes('%')) env.STASHDOCK_DATA_DIR = value;
  } catch { /* No override: use the standard platform application directory. */ }
}
