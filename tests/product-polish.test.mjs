import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('shared import has natural spring height and file selection keeps a separate Save',()=>{
  assert.match(read('src/components/FluidDialog.tsx'),/new ResizeObserver\(measure\)/);
  assert.doesNotMatch(read('src/components/FluidDialog.module.css'),/height: min\(660px/);
  assert.match(read('src/components/ReferenceFileImport.tsx'),/showBrowse=\{false\}/);
  assert.match(read('src/components/ReferenceFileImport.tsx'),/<Button type="button" variant="primary" disabled>\{t\("Save file"\)\}/);
});
test('card menus are exclusive and self-explanatory copy has no tooltip',()=>{
  const menu=read('src/components/DesktopMenu.tsx');assert.match(menu,/open=\{open\}/);assert.match(menu,/stashdock:menu-open/);assert.match(menu,/inert: !open/);
  assert.doesNotMatch(read('src/components/CopyForAI.tsx'),/data-tooltip/);
  assert.match(read('src/components/WindowControls.tsx'),/<Button type="button" variant="ghost" size="sm"/);
  assert.match(read('src/components/WindowControls.module.css'),/--surface-muted: var\(--border\)/);
  assert.doesNotMatch(read('src/components/WindowControls.module.css'),/border-radius:|:hover|:active/);
  assert.match(read('src/features/library/LibraryView.module.css'),/border-radius: var\(--radius-panel\); box-shadow: var\(--shadow-raised\)/);
});
