import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cpSync, existsSync, rmSync } from 'node:fs';

if (process.platform !== 'darwin') throw Error('Use the desktop:* commands on Windows.');
const [action, ...options] = process.argv.slice(2);
const safari = options.includes('--with-safari');
const unsigned = options.includes('--unsigned');
const extra = options.filter(value => value !== '--with-safari' && value !== '--unsigned');
if (!['dev', 'check', 'test', 'build'].includes(action)) throw Error('Choose dev, check, test or build.');
if ((safari || unsigned) && action !== 'build') throw Error('Safari embedding is a build action.');
if (safari && !unsigned && !process.env.APPLE_SIGNING_IDENTITY) throw Error('Set APPLE_SIGNING_IDENTITY for a signed containing app, or use --unsigned for a local development build.');
const root = resolve(import.meta.dirname, '..');
function run(command, args, env = process.env) {
  const child = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status ?? 1);
}
run(process.execPath, ['scripts/sync-pdf-assets.mjs']);
run(process.execPath, ['scripts/generate-brand.mjs']);
run(process.execPath, ['scripts/generate-reference-icons.mjs']);
run(process.execPath, ['scripts/generate-native-folder.mjs']);
if (action === 'check' || action === 'test') {
  run('cargo', [action, '--manifest-path', 'src-tauri/Cargo.toml', '--locked', ...extra]);
  if (action === 'test') {
    run(process.execPath, ['scripts/verify-native-search.mjs']);
    run(process.execPath, ['scripts/verify-native-search-publication.mjs']);
    run(process.execPath, ['scripts/verify-native-handoff.mjs']);
  }
} else {
  if (action === 'build') run('cargo', ['build', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--release', '--bin', 'stashdock-browser']);
  // Both the renderer helper bundle and optional Safari extension change the
  // outer seal. Assemble once, embed, then sign from the innermost bundle out.
  const assembleEnv = action === 'build' ? { ...process.env, APPLE_SIGNING_IDENTITY: '-' } : process.env;
  run(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', action, ...extra], assembleEnv);
  // Tauri's final Cargo feature/configuration set owns the packaged helper.
  // Embed that exact binary in Safari rather than an earlier Cargo variant.
  if (action === 'build' && safari) run(process.execPath, ['scripts/build-safari.mjs', '--helper-ready', ...(unsigned ? ['--unsigned'] : [])]);
  if (action === 'build') {
    const app = resolve(root, 'src-tauri/target/release/bundle/macos/StashDock.app');
    const renderer = resolve(root, 'src-tauri/native-binaries/StashDockRenderer.app');
    if (!existsSync(renderer) || !existsSync(app)) throw Error('Build the native renderer and Desktop app before embedding.');
    const nested = resolve(app, 'Contents/Helpers/StashDockRenderer.app');
    cpSync(renderer, nested, { recursive: true });
    // The floating search uses the approved Inter face through public CoreText,
    // including the original variable font, not an approximate system weight.
    cpSync(resolve(root,'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),resolve(app,'Contents/Resources/Fonts/inter-latin-wght-normal.woff2'),{recursive:true});
    cpSync(resolve(root,'public/licenses/Inter-OFL.txt'),resolve(app,'Contents/Resources/licenses/Inter-OFL.txt'));
    // Retired generated sidecar from earlier local development bundles.
    rmSync(resolve(app, 'Contents/MacOS/stashdock-render'), { force: true });
    const identity = unsigned ? '-' : process.env.APPLE_SIGNING_IDENTITY || '-';
    const sign = target => run('codesign', ['--force', '--sign', identity,
      ...(identity !== '-' ? ['--options', 'runtime', '--timestamp=none'] : []), target]);
    sign(nested);
    if (!safari) rmSync(resolve(app, 'Contents/PlugIns/StashDock Safari Extension.appex'), { recursive: true, force: true });
    if (safari) {
      const source = resolve(root, 'output/safari/products/StashDock Safari Extension.appex');
      if (!existsSync(source)) throw Error('Build the matching Safari extension before embedding.');
      const destination = resolve(app, 'Contents/PlugIns/StashDock Safari Extension.appex');
      cpSync(source, destination, { recursive: true });
      if (unsigned) run('codesign', ['--force', '--sign', '-', '--entitlements', 'safari/Development.entitlements', destination]);
      else run('codesign', ['--verify', '--strict', destination]);
    }
    cpSync(resolve(root, 'src-tauri/target/release/stashdock-browser'), resolve(app, 'Contents/MacOS/stashdock-browser'));
    for (const helper of ['stashdock-preview', 'stashdock-storage', 'stashdock-browser']) {
      const file = resolve(app, 'Contents/MacOS', helper);
      if (existsSync(file)) sign(file);
    }
    sign(app);
    run('codesign', ['--verify', '--strict', '--deep', app]);
    console.log(`Desktop with native renderer${safari ? ' and Safari extension' : ''}: ${app}`);
  }
}
