#!/usr/bin/env node
// Copies the public product source from this private tree into the separate
// public checkout, using the same path rules as verify-public-source.mjs.
// Only committed files are exported. Files the public checkout tracks that are
// no longer public source are listed; pass --prune to `git rm` them there.
// Review `git status` in the public checkout, then stage and run
// verify-public-source.mjs against it before committing.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { privateSourcePath, rootFiles, sourceRoots } from './verify-public-source.mjs';

const root = resolve(import.meta.dirname, '..');
const [target, ...flags] = process.argv.slice(2);
if (!target) throw Error('Usage: node scripts/export-public-source.mjs <public-checkout> [--prune]');
const publicRoot = resolve(target);
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (git(publicRoot, 'remote', 'get-url', 'origin').trim() !== 'https://github.com/StashDock/StashDock.git') throw Error('The target must be the public StashDock checkout.');
if (git(publicRoot, 'status', '--porcelain').trim()) throw Error('Commit or set aside changes in the public checkout first.');
if (git(root, 'status', '--porcelain').trim()) throw Error('Commit the private source first; only committed files are exported.');

export const isPublic = path => !privateSourcePath(path) && (rootFiles.has(path) || sourceRoots.has(path.split('/')[0]));
const files = git(root, 'ls-files', '-z').split('\0').filter(Boolean).filter(isPublic);
for (const path of files) {
  mkdirSync(dirname(join(publicRoot, path)), { recursive: true });
  copyFileSync(join(root, path), join(publicRoot, path));
}
const exported = new Set(files);
const stale = git(publicRoot, 'ls-files', '-z').split('\0').filter(Boolean).filter(path => !exported.has(path));
if (stale.length && flags.includes('--prune')) execFileSync('git', ['-C', publicRoot, 'rm', '-q', '--', ...stale]);
console.log(JSON.stringify({ exported: files.length, sourceCommit: git(root, 'rev-parse', 'HEAD').trim(), notPublicSource: stale, pruned: flags.includes('--prune') }, null, 2));
