// Observe only processes belonging to this test's random capture directory.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createPreviewHelperRunner } from '../plugins/stashdock/server/preview-helper.mjs';
const execute = promisify(execFile);
const helper = resolve(process.argv[2] || 'src-tauri/target/release/stashdock-preview.exe');
let profile;
const run = createPreviewHelperRunner({ launch: (...args) => {
  profile = args[2].env.STASHDOCK_CAPTURE_PROFILE_ROOT;
  return spawn(...args);
} });
const processes = async () => {
  const { stdout } = await execute(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command',
    "$p=@(Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($env:STASHDOCK_VERIFY_PROFILE)}); [pscustomobject]@{count=$p.Count;workingSetBytes=($p | Measure-Object WorkingSetSize -Sum).Sum} | ConvertTo-Json -Compress"],
  { windowsHide: true, timeout: 8000, env: { ...process.env, STASHDOCK_VERIFY_PROFILE: profile } });
  return JSON.parse(stdout);
};
const cancel = new AbortController();
const pending = run(helper, { url: 'https://arxiv.org/pdf/2505.22954', lookup: true }, cancel.signal, { timeout: 95_000 });
let completed = false;
pending.then(() => { completed = true; }, () => { completed = true; });
let observed;
try {
  for (let attempt = 0; attempt < 8 && !completed; attempt++) {
    observed = await processes();
    if (observed.count > 0) break;
  }
  assert.ok(observed?.count > 0 && !completed, 'Did not observe the active test-owned renderer before cancellation');
} finally { cancel.abort(); }
await assert.rejects(pending, /cancelled/);
let remaining = await processes();
if (remaining.count) remaining = await processes();
assert.equal(remaining.count, 0, 'Cancelled renderer processes remain alive');
assert.equal(existsSync(profile), false, 'Cancelled scratch directory remains');
const recovered = await run(helper, { url: 'https://arxiv.org/pdf/2505.22954', lookup: true }, undefined, { timeout: 95_000 });
assert.ok(recovered.preview && /Darwin/i.test(recovered.title), 'A new renderer did not recover after cancellation');
const result = { helper, observedRendererProcesses: observed.count, sampledWorkingSetMiB: Math.round(Number(observed.workingSetBytes)/1048576), remainingRendererProcesses: remaining.count, temporaryDirectoryRemoved: true, subsequentPdfSucceeded: true };
await writeFile('output/system-renderer/cancellation-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
