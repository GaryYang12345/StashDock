// Translate the approved web tokens. AppKit must not invent a second palette.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { writeIfChanged } from './lib/write-if-changed.mjs';
const root = resolve(import.meta.dirname, '..');
const read = file => readFile(resolve(root, file), 'utf8');
const foundation = await read('src/components/arc/foundation.css');
const product = await read('src/styles/product-tokens.css');
const index = await read('src/index.css');
const declarations = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
const first = text => text.slice(text.indexOf('{') + 1, text.indexOf('}'));
const base = { ...declarations(first(foundation)), ...declarations(first(product)) };
const dark = { ...base, ...declarations(first(foundation.slice(foundation.indexOf(':root[data-theme="dark"]')))), ...declarations(first(product.slice(product.indexOf(':root[data-theme="dark"]')))) };
function lab(value, tokens) {
  if (value.startsWith('var(')) return lab(tokens[value.slice(6, -1)], tokens);
  const m = value.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/);
  if (!m) throw Error(`Unsupported native colour: ${value}`);
  const [, light, chroma, hue] = m.map(Number);
  return [light / 100, chroma * Math.cos(hue * Math.PI / 180), chroma * Math.sin(hue * Math.PI / 180)];
}
function rgb([l, a, b]) {
  const L = (l + .3963377774 * a + .2158037573 * b) ** 3;
  const M = (l - .1055613458 * a - .0638541728 * b) ** 3;
  const S = (l - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + .2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - .3413193965 * S, -.0041960863 * L - .7034186147 * M + 1.707614701 * S].map(v => Math.max(0, Math.min(1, v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055)));
}
const mix = (a, b, weight) => a.map((v, i) => v * weight + b[i] * (1 - weight));
const accents = { web:'teal', repo:'ink', note:'violet', pdf:'red', document:'blue', text:'slate', markdown:'brown', data:'amber', presentation:'presentation', spreadsheet:'green', archive:'amber', video:'indigo', audio:'rose', code:'cyan', image:'blue', file:null };
const themes = {};
for (const [name, tokens] of Object.entries({ light:base, dark })) {
  const color = key => lab(tokens[key], tokens);
  const roles = ['background','surface','surface-raised','surface-muted','foreground','text-secondary','text-muted','border','success'];
  themes[name] = Object.fromEntries(roles.map(key => [key, rgb(color(key))]));
  themes[name].covers = Object.fromEntries(Object.entries(accents).map(([kind, accent]) => {
    const ink = color(accent ? `reference-${accent}` : 'text-secondary');
    return [kind, { fill:rgb(mix(ink, color('surface-muted'), .08)), caption:rgb(mix(ink, color('foreground'), .76)) }];
  }));
  const block = index.match(name === 'dark' ? /html\.desktop-search\[data-theme="dark"\]\s*\{([^}]+)\}/ : /html\.desktop-search\s*\{([^}]+)\}/)[1];
  themes[name].elevation = [...block.matchAll(/0 ([\d.]+)(?:px)? ([\d.]+)(?:px)?(?: ([\d.]+)px)? oklch\(([\d.]+)% 0 0 \/ ([\d.]+)\)/g)].map(([,dy,blur,spread,light,opacity]) => ({dy:Number(dy),blur:Number(blur),spread:Number(spread||0),opacity:Number(opacity),color:rgb([Number(light)/100,0,0])}));
  if (themes[name].elevation.length !== (name === 'dark' ? 3 : 2)) throw Error('Unknown folder elevation. Update the native translator.');
}
const bundle = await build({ stdin:{ contents:"import {motionTokens} from './src/components/arc/motion-tokens';module.exports=motionTokens", resolveDir:root }, bundle:true, write:false, format:'cjs', platform:'node' });
const module = {exports:{}};
new Function('module', bundle.outputFiles[0].text)(module);
// Interaction waits belong to the approved Windows owners too. Fail the build
// if an owner changes shape, rather than silently retaining a Mac-only delay.
const folderSearch = await read('src/features/folder-search/FolderSearch.tsx');
const nativeSearch = await read('src-tauri/src/folder_search.rs');
const floatingFolder = await read('src/components/FloatingFolder.tsx');
const buttonCSS = await read('src/components/arc/button/button.module.css');
const number = (source, pattern) => {
  const match = source.match(pattern);
  if (!match) throw Error(`Unknown search timing owner: ${pattern}`);
  return Number(match[1]);
};
const interaction = {
  intent: number(nativeSearch, /const INTENT: Duration = Duration::from_millis\((\d+)\)/) / 1000,
  debounce: number(folderSearch, /const SEARCH_DELAY = (\d+)/) / 1000,
  copied: number(folderSearch, /const COPIED_MS = (\d+)/) / 1000,
  closeStagger: number(folderSearch, /staggerChildren: reduced \? 0 : ([\d.]+)/),
  closeOpacityDelay: number(folderSearch, /opacity: \{ duration: motionTokens.duration.fast, delay: ([\d.]+)/),
  spinner: number(buttonCSS, /animation: spin ([\d.]+)s/),
  folderRelease: number(floatingFolder, /setSearchOpen\(false\), (\d+)\)/) / 1000,
};
const buttonSource = await read('src/components/arc/button/button.tsx');
const clearSource = await read('src/components/arc/search-field/search-field.tsx');
const controls = {
  labelInY:number(buttonSource,/const textIn:[^;]+y: (-?[\d.]+)/),
  labelOutY:number(buttonSource,/const textOut:[^;]+y: (-?[\d.]+)/),
  loaderInScale:number(buttonSource,/const iconIn:[^;]+scale: ([\d.]+)/),
  loaderOutScale:number(buttonSource,/exit=\{reduceMotion \? fadeOut : \{ \.\.\.iconOut, scale: ([\d.]+)/),
  clearFoldScale:number(clearSource,/key="clear"[^\n]+opacity: 0, scale: ([\d.]+)/),
};
const spec = { themes, motion:module.exports, interaction, controls };
const json = JSON.stringify(spec);
await writeIfChanged(resolve(root, 'src-tauri/native/SearchTokens.generated.swift'), `// Generated from Arc foundation, product colours and motion tokens. Do not edit.\nlet searchTokenJSON = #"${json}"#\n`);
// Spatial handoff is a separate public AppKit adapter, with the same approved
// Windows choreography. Fail on an unrecognized owner rather than hand-tune it.
const morph = await read('src-tauri/src/window_morph.rs');
const handoff = {
  expand:number(morph,/Direction::Expand => Duration::from_millis\((\d+)\)/)/1000,
  collapse:number(morph,/Direction::Collapse => Duration::from_millis\((\d+)\)/)/1000,
  seed:number(morph,/let width = folder.width\(\) \* ([\d.]+)/),
  grow:number(morph,/folder: scaled\(1.0 \+ ([\d.]+)/),
  expandPanelFade:number(morph,/panel_opacity: opacity\(enter\(ramp\(t, 0.0, ([\d.]+)/),
  expandFolderFade:number(morph,/folder_opacity: opacity\(1.0 - ramp\(t, 0.0, ([\d.]+)/),
  collapsePanelFadeStart:number(morph,/panel_opacity: opacity\(1.0 - ramp\(t, ([\d.]+),/),
  collapsePanelFadeEnd:number(morph,/panel_opacity: opacity\(1.0 - ramp\(t, [\d.]+, ([\d.]+)/),
  collapseFolderScale:number(morph,/folder: scaled\(([\d.]+) \+ [\d.]+ \* enter/),
  collapseFolderMoveStart:number(morph,/folder: scaled\([^\n]+enter\(ramp\(t, ([\d.]+),/),
  collapseFolderFadeStart:number(morph,/folder_opacity: opacity\(enter\(ramp\(t, ([\d.]+),/),
  collapseFolderFadeEnd:number(morph,/folder_opacity: opacity\(enter\(ramp\(t, [\d.]+, ([\d.]+)/),
  enter:module.exports.ease.enter, inOut:module.exports.ease.inOut,
};
if(Math.abs(handoff.collapseFolderScale + number(morph,/folder: scaled\([\d.]+ \+ ([\d.]+) \* enter/) - 1) > 1e-9) throw Error('Unknown handoff folder scale trajectory.');
for(const name of ['enter','inOut']) {
  const owner = morph.match(new RegExp(`fn ${name === 'inOut' ? 'in_out' : name}\\(t: f64\\) -> f64 \\{\\s*bezier\\(([^)]+), t\\)`));
  if(!owner || JSON.stringify(owner[1].split(',').map(Number)) !== JSON.stringify(handoff[name])) throw Error('Handoff easing diverged from shared Arc owner.');
}
await writeIfChanged(resolve(root,'src-tauri/native/WindowHandoffTokens.generated.swift'),`// Generated from window_morph.rs and Arc motion. Do not edit.\nlet handoffTokenJSON = #"${JSON.stringify(handoff)}"#\n`);
const identity = await read('src/lib/siteIdentity.ts');
const paths = identity.match(/fallbacks = \[([^\]]+)\]/)?.[1];
if (!paths) throw Error('Unknown site favicon candidate owner.');
const faviconPaths = [...paths.matchAll(/"([^"\n]+)"/g)].map(match => match[1]);
if (faviconPaths.length !== 4 || faviconPaths.some(path => !/^\/[\w.-]+$/.test(path))) throw Error('Unknown site favicon paths.');
await writeIfChanged(resolve(root,'assets/generated/native-favicon-paths.json'),JSON.stringify(faviconPaths)+'\n');
export { themes };
