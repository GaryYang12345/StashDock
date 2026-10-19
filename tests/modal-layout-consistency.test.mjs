import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(path,'utf8');
test('all active dialogs share Arc padding, first-line close alignment and stable import bounds',()=>{
  const css=source('src/components/FluidDialog.module.css');
  assert.match(css,/\.header \{[^}]*padding: var\(--space-6\)/);
  assert.match(css,/\.close \{[^}]*margin-block: calc/);
  assert.doesNotMatch(css,/\[data-size="import"\] \.header[^}]*padding:/);
  assert.doesNotMatch(css,/height: min\(660px/);
  assert.match(source('src/components/FluidDialog.tsx'),/new ResizeObserver\(measure\)/);
  const form=source('src/components/DesktopImportDialog.tsx'); assert.match(form,/className=\{styles.importTabs\}/); assert.match(form,/className=\{styles.typeTab\}/);
  assert.match(source('src/components/DesktopImportDialog.module.css'),/\.tabLabel \{ display: flex;/);
  assert.match(source('src/components/ReferenceTagsField.tsx'),/label=\{t\("Existing tags"\)\} fade=\{0\}/);
  for(const path of ['src/features/library/LibraryView.tsx','src/features/mcp-app/McpShelf.tsx'])assert.match(source(path),/ReferenceImportDialog/);
});
