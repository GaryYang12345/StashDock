import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// Compile the actual desktop guard in isolation; no SDK, linker or user data.
const main = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');
const guard = main.match(/#\[cfg\(all\(not\(debug_assertions\), dev, not\(test\)\)\)\]\s*compile_error!\([^;]+;/)?.[0];
assert.ok(guard, 'The desktop compile-time production guard is missing.');
const output = mkdtempSync(join(tmpdir(), 'stashdock-release-guard-'));
try {
  for (const [name, flags, rejected] of [
    ['development', ['--cfg', 'dev', '-C', 'debug-assertions=yes'], false],
    ['production', ['-C', 'debug-assertions=no'], false],
    ['unpackaged-release', ['--cfg', 'dev', '-C', 'debug-assertions=no'], true],
  ]) {
    const result = spawnSync('rustc', ['--crate-name', 'packaging_guard', '--emit=metadata', '-o', join(output, `${name}.rmeta`), ...flags, '-'], {
      input: `${guard}\nfn main() {}`, encoding: 'utf8', windowsHide: true,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, rejected ? 1 : 0, result.stderr);
    if (rejected) assert.match(result.stderr, /Release desktop builds require --features tauri\/custom-protocol/);
    console.log(`${name}: ${rejected ? 'rejected' : 'accepted'}`);
  }
} finally {
  assert.equal(dirname(output), tmpdir());
  assert.ok(output.startsWith(join(tmpdir(), 'stashdock-release-guard-')));
  rmSync(output, { recursive: true, force: true });
}
