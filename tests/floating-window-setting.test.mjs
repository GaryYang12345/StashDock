import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const read=path=>readFile(path,'utf8');

test('desktop floating policy is persisted, defaults on and is not exposed as an AI-host setting',async()=>{
  const preferences=await read('src/features/settings/preferences.tsx');
  assert.match(preferences,/floatingWindow: true/);
  const settings=await read('src/features/settings/SettingsView.tsx');
  assert.match(settings,/save\(\{ floatingWindow: value === 'on' \}\)/);
  assert.doesNotMatch(await read('src/features/mcp-app/settings.tsx'),/Floating window|floatingWindow/);
  const native=await read('src-tauri/src/desktop_windows.rs');
  assert.match(native,/Surface::Folder => Intent::Minimize/);
  assert.match(native,/policy::resolve\(/);
  assert.match(native,/minimize_immediately/);
  const policy=await read('src-tauri/src/desktop_window_policy.rs');
  assert.match(policy,/if floating[\s\S]*Mode::Folder[\s\S]*Mode::Minimized/);
  assert.match(native,/if !floating_enabled\(app\)/);
  assert.match(native,/app.exit\(0\)/);
  const source=await read('src-tauri/src/settings.rs');
  assert.match(source,/#\[serde\(default = "default_floating_window"\)\]/);
  for(const command of ['get_desktop_settings','save_desktop_preferences','set_launch_at_login']) assert.match(source,new RegExp('pub async fn '+command));
  assert.match(native,/if !state.persistence.request\(\)/);
  assert.match(native,/previous.as_ref\(\) == Some\(&bytes\)/);
});

test('native titlebar names reflect normal minimization and quit when the folder is off',async()=>{
  const compiled=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {WindowControls} from './src/components/WindowControls';export const on=renderToStaticMarkup(<WindowControls/>);export const off=renderToStaticMarkup(<WindowControls floatingWindow={false}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.module.css':'empty'}});
  const module={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  assert.match(module.exports.on,/aria-label="Minimize to folder"/);
  assert.match(module.exports.on,/aria-label="Hide StashDock"/);
  assert.match(module.exports.off,/aria-label="Minimize window"/);
  assert.match(module.exports.off,/aria-label="Close StashDock"/);
  assert.doesNotMatch(module.exports.off,/Minimize to folder|Hide StashDock/);
});
