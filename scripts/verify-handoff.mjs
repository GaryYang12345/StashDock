// Portable, dependency-free check of the delivered source package only.
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(process.argv[2] || dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'HANDOFF_MANIFEST.json'), 'utf8'));
if (![1, 2].includes(manifest.formatVersion) || !Array.isArray(manifest.files)) throw Error('Invalid handoff manifest.');
const known = new Set(['HANDOFF_MANIFEST.json']);
for (const file of manifest.files) {
  const path = resolve(root, file.path), within = relative(root, path);
  if (!within || within.startsWith('..') || isAbsolute(within) || known.has(file.path)) throw Error('Invalid package path.');
  if (lstatSync(path).isSymbolicLink()) throw Error(`Unexpected symbolic link: ${file.path}`);
  const bytes = readFileSync(path);
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error(`Package mismatch: ${file.path}`);
  known.add(file.path);
}
function inspect(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, item.name), name = relative(root, path).replaceAll('\\', '/');
    if (item.isSymbolicLink()) throw Error(`Unexpected symbolic link: ${name}`);
    if (item.isDirectory()) inspect(path);
    else if (!known.has(name)) throw Error(`Unlisted package file: ${name}`);
  }
}
inspect(root);
const requiredFiles = manifest.formatVersion === 2
  ? ['AGENTS.md','design.md','.agents/skills/arc/SKILL.md','.agents/skills/arc/LICENSE','docs/MAC_HANDOFF_PROMPT.zh-CN.md','START_HERE.zh-CN.md','BASELINE.json']
  : ['AGENTS.md','design.md','package-lock.json','src-tauri/Cargo.lock','.agents/skills/arc/SKILL.md','plugins/stashdock/skills/use-stashdock/SKILL.md','docs/MAC_HANDOFF_PROMPT.zh-CN.md','MAC_START_HERE.zh-CN.md'];
for (const required of requiredFiles) {
  if (!known.has(required)) throw Error(`Required handoff file missing: ${required}`);
}
if (manifest.formatVersion === 2) {
  const baseline = JSON.parse(readFileSync(join(root, 'BASELINE.json'), 'utf8'));
  if (manifest.kind !== 'github-source-handoff' || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || baseline.sourceCommit !== manifest.sourceCommit || baseline.repository !== 'https://github.com/GaryYang12345/StashDock') throw Error('Invalid source baseline.');
}
console.log(JSON.stringify({verified:true,files:manifest.files.length,macBuildVerified:manifest.macBuildVerified,personalLibraryIncluded:false}));
