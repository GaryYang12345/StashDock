import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('alternate textarea views preserve the field, label action, original draft and scroll', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const names = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name] });
  let root;
  try {
    const compiled = await build({ stdin: { contents: `
      import {useState} from 'react';
      import {Textarea} from './src/components/arc/textarea/textarea';
      export function Fixture() {
        const [preview,setPreview]=useState(false);
        return <Textarea label="Context content" value="Original draft" onChange={()=>{}}
          aria-hidden={preview||undefined} inert={preview} tabIndex={preview?-1:undefined}
          labelAction={<button onClick={()=>setPreview(!preview)}>Content / Preview</button>}
          controlOverlay={preview?<section aria-label="Markdown preview">Rendered context</section>:undefined} />;
      }
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.module.css': 'empty' }, external: ['react', 'react-dom'] });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(module.exports.Fixture)));
    const textarea = document.querySelector('textarea');
    const label = document.querySelector('label');
    const action = document.querySelector('button');
    const frame = textarea.parentElement;
    textarea.scrollTop = 64;
    for (let i = 0; i < 4; i++) {
      await act(async () => action.click());
      const preview = i % 2 === 0;
      assert.equal(document.querySelector('textarea'), textarea);
      assert.equal(document.querySelector('label'), label);
      assert.equal(document.querySelector('button'), action);
      assert.equal(textarea.parentElement, frame);
      assert.equal(textarea.value, 'Original draft');
      assert.equal(textarea.scrollTop, 64);
      assert.equal(label.htmlFor, textarea.id);
      assert.equal(textarea.hasAttribute('hidden'), false, 'Preview must not collapse the layout reservation');
      assert.equal(textarea.getAttribute('aria-hidden'), preview ? 'true' : null);
      assert.equal(textarea.hasAttribute('inert'), preview);
      assert.equal(textarea.tabIndex, preview ? -1 : 0);
      assert.equal(Boolean(frame.querySelector('[aria-label="Markdown preview"]')), preview);
    }
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const name of names) { const descriptor = originals.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
