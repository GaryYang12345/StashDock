// Compile the production Swift boundary, not a JavaScript copy of its rules.
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'darwin') throw Error('Run the Safari native boundary check on macOS.');
const root = resolve(import.meta.dirname, '..');
const scratch = await mkdtemp(join(tmpdir(), 'stashdock-safari-native-test-'));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(result.stderr || result.stdout || `Exit ${result.status}`);
  if (result.stdout) process.stdout.write(result.stdout);
}
try {
  await copyFile(join(root, 'tests/safari-native-request.swift'), join(scratch, 'main.swift'));
  const executable = join(scratch, 'verify');
  run('xcrun', ['swiftc', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.0`, join(root, 'safari/SafariCaptureProtocol.swift'), join(root, 'safari/SafariWebExtensionHandler.swift'), join(scratch, 'main.swift'), '-o', executable]);
  run(executable, []);
} finally { await rm(scratch, { recursive: true, force: true }); }
