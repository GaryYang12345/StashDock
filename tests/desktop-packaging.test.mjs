import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('backend-only desktop releases embed production assets just like the Tauri CLI', () => {
  const script = readFileSync(new URL('../scripts/with-msvc.ps1', import.meta.url), 'utf8');
  assert.match(script, /cargo build --release --bins --features tauri\/custom-protocol/);
  const main = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');
  assert.match(main, /#\[cfg\(all\(not\(debug_assertions\), dev, not\(test\)\)\)\]/);
  assert.match(main, /compile_error!\(\s*"Release desktop builds require/);
});
