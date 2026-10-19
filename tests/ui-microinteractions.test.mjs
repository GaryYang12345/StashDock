import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('card gestures remain available but only the context bar displays a drag grip', async () => {
  for (const path of ['src/components/StashCard.tsx']) {
    const source=await read(path);
    assert.doesNotMatch(source,/GripVertical|styles.grip/);
    assert.match(source,/draggable: true, onDragStartCapture: startDrag/);
  }
  assert.match(await read('src/components/ContextBar.tsx'),/<GripVertical/);
});

test('navigation owns one persistent indicator per list and does not paint the destination early', async () => {
  const source=await read('src/components/Sidebar.tsx'), css=await read('src/components/Sidebar.module.css');
  assert.equal((source.match(/<motion.span className=\{styles.highlight\}/g)||[]).length,1);
  assert.doesNotMatch(source,/layoutId|selected && highlight|slice\(0, 7\)/);
  assert.match(source,/offsetLeft/);
  assert.match(source,/motionTokens.spring.smooth/);
  assert.match(css,/\.row\s*\{[^}]*--surface-muted: transparent/);
  assert.match(source,/<ScrollArea[^>]+label=\{t\("Tag filters"\)\} fade=\{24\}/);
  assert.ok(source.indexOf('className={styles.tagHeading}') < source.indexOf('<ScrollArea'), 'Tags heading must stay outside the list scroll owner');
  assert.equal((source.match(/<ScrollArea/g)||[]).length,1);
});


test('favorite pointer focus does not pin grid or list controls, and import is secondary', async()=>{
  const css=await read('src/components/StashCard.module.css');
  assert.doesNotMatch(css,/:focus-within/);
  assert.match(css,/\.controls:has\(:focus-visible\)/);
  assert.match(await read('src/styles/product-tokens.css'),/--favorite-star: #E8B931/);
  assert.match(await read('src/components/Toolbar.tsx'),/variant="secondary" size="sm" onClick=\{onAdd\}/);
});


test('image controls are circular and the saved star has its own semantic color',async()=>{
  const css=await read('src/components/StashCard.module.css');
  assert.match(css,/\.iconButton \{ width: var\(--control-height-sm\); height: var\(--control-height-sm\); padding-inline: 0; border-radius: var\(--radius-pill\)/);
  assert.match(css,/\.favorite svg \{ color: var\(--favorite-star\)/);
  assert.match(await read('src/components/StashCard.tsx'),/item.favorite \? styles.favorite/);
});

test('independent folder does not mount the shelf and shelf state stays mounted',async()=>{
  assert.match(await read('src/index.css'),/\.desktop-panel \{ position: relative; height: 100dvh/);
  const source=await read('src/components/DesktopWindows.tsx');
  assert.doesNotMatch(source,/dockMounted|<DockView|openDock/);
  assert.match(source,/if \(surface === "folder"\) return.*<FloatingFolder/);
  assert.match(source,/renderLibrary\(.*status.visible === "panel"/);
});

test('repeat copy acknowledges a real new attempt and releases its feedback timer on unmount', async () => {
  const source=await read('src/components/CopyForAI.tsx');
  assert.match(source,/await onCopy\(\)/);
  assert.match(source,/phase !== "settled"/);
  assert.match(source,/motionTokens.duration.fast \* 1000/);
  assert.match(source,/clearTimeout\(timer\)/);
  assert.doesNotMatch(source,/if \(copied\) return/);
});

test('business hover hints never use native title attributes', async () => {
  for(const path of ['src/components/CopyForAI.tsx','src/components/FloatingFolder.tsx','src/components/Sidebar.tsx','src/components/SiteIdentity.tsx','src/components/StashCard.tsx','src/components/Toolbar.tsx','src/components/WindowControls.tsx']) {
    const file=ts.createSourceFile(path,await read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const visit=node=>{
      if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) {
        const tag=node.tagName.getText(file);
        if(/^[a-z]/.test(tag)||tag==='Button') assert.ok(!node.attributes.properties.some(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(file)==='title'),path+' has a native title');
      }
      ts.forEachChild(node,visit);
    };
    visit(file);
  }
  assert.doesNotMatch(await read('extension/sidepanel.js'),/\b(?:title|copyButton|deleteButton)\.title\s*=/);
});

test('one tooltip adapter handles top-layer dialogs, keyboard dismissal and cleanup without retired folder IPC', async () => {
  const source=await read('src/lib/tooltips.ts');
  for(const contract of ['dialog[open]','aria-describedby','prefers-reduced-motion','stopImmediatePropagation','observer.disconnect()','pointerEvents','removeEventListener','showPopover','closeTopLayer']) assert.ok(source.includes(contract),contract);
  assert.doesNotMatch(source, /FolderHint|nativeHint|folderHint/);
  const layer=await read('src/components/TooltipLayer.tsx');
  assert.match(layer,/return installTooltips\(document/);
  assert.match(layer,/classList.contains\('desktop-folder'\)\) return/);
  assert.match(await read('extension/sidepanel.js'),/installTooltips\(document/);
  assert.match(await read('scripts/sync-extension-ui.mjs'),/src\/lib\/tooltips.ts/);
  assert.match(source,/const hide = \(\) => \{[\s\S]*?if \(!anchor\) return;/);
});

test('reduced motion updates during the session and unsubscribes its media listener', async () => {
  const source=await read('src/lib/useReducedMotionPreference.ts');
  assert.match(source,/useSyncExternalStore/);
  assert.match(source,/addEventListener\("change", notify\)/);
  assert.match(source,/removeEventListener\("change", notify\)/);
});

test('hints are explicit, delayed and use the requested compact reference style',async()=>{
  const source=await read('src/lib/tooltips.ts'),css=await read('src/styles/tooltips.css');
  assert.match(source,/const selector = "\[data-tooltip\]"/);
  assert.match(source,/instant \? 0 : 700/);
  assert.doesNotMatch(source,/lastClosed|button\[aria-label\]/);
  assert.match(css,/--tooltip-surface: #0d0d0d/);
  assert.match(css,/--tooltip-radius: var\(--space-2\)/);
  assert.doesNotMatch(await read('src/components/SiteIdentity.tsx'),/data-tooltip/);
  assert.doesNotMatch(await read('src/components/Sidebar.tsx'),/data-tooltip/);
});
