import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('dialog entrance separates fades from content height and never scales text', () => {
  const code = readFileSync('src/components/FluidDialog.tsx', 'utf8');
  assert.match(code, /animate\(height, next, motionTokens.spring.smooth\)/);
  assert.match(code, /measuredHeight.current === undefined \|\| reduced/);
  assert.match(code, /height.jump\(next\)/);
  assert.doesNotMatch(code, /setHeight|offsetHeight|animate=\{[^\n]*height/);
  assert.match(code, /const fade: Transition = \{ duration: reduced \? 0 : motionTokens.duration.standard/);
  assert.match(code, /opacity: fade/);
  assert.match(code, /y: motionTokens.spring.smooth/);
  assert.match(code, /initial=\{\{ opacity: 0, y: reduced \? 0 : 16 \}\}/);
  assert.match(code, /exit=\{\{ \.\.\.exit, y: reduced \? 0 : 8 \}\}/);
  assert.match(code, /reduced \? \{ duration: 0 \}/);
  assert.doesNotMatch(code, /scale:/);
  assert.match(code, /useLayoutEffect\(\(\) => \{\s*if \(!open\) return;[\s\S]*setHost/);
});

test('core import is available with the shelf without click-time Suspense or preloading policies', () => {
  const code = readFileSync('src/features/library/LibraryView.tsx', 'utf8');
  assert.match(code, /import \{ ReferenceImportDialog \} from/);
  assert.match(code, /<ReferenceImportDialog ref=\{importDialog\}/);
  assert.doesNotMatch(code, /loadImportDialog|prepareImportDialog|requestIdleCallback/);
  assert.equal(existsSync('src/features/library/importDialogLoader.ts'), false);
});

test('dialog alone owns opening; hosts read current state without a shelf subscription', () => {
  const wrapper = readFileSync('src/components/ReferenceImportDialog.tsx', 'utf8');
  assert.match(wrapper, /useImperativeHandle/);
  assert.match(wrapper, /isOpen: \(\) => visible.current/);
  assert.match(wrapper, /state.mounted \? <DesktopImportDialog/);
  assert.match(wrapper, /if \(!active\) close\(\)/);
  for (const path of ['src/features/library/useLibraryController.ts', 'src/features/mcp-app/McpShelf.tsx']) {
    const host = readFileSync(path, 'utf8');
    assert.doesNotMatch(host, /\[(?:addOpen|addMounted|importOpen),/);
    assert.match(host, /importDialog.current\?\.isOpen\(\)/);
  }
  const mcp = readFileSync('src/features/mcp-app/McpShelf.tsx', 'utf8');
  assert.match(mcp, /const current = \(\) => !disposed && !importDialog.current\?\.isOpen\(\)/);
});
