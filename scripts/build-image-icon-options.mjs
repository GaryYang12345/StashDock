// Isolated comparison artifact. Production icons and user data are untouched.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const choices = [
  ['A', 'vscode-icons', 'file-type-image', '绿色图片文件'],
  ['B', 'flat-color-icons', 'night-landscape', '紫色夜景'],
  ['C', 'flat-color-icons', 'image-file', '蓝色图片文件（之前的图标）'],
  ['D', 'flat-color-icons', 'camera', '紫色相机'],
  ['E', 'flat-color-icons', 'compact-camera', '蓝灰色相机'],
  ['F', 'flat-color-icons', 'landscape', '绿色风景'],
  ['G', 'flat-color-icons', 'picture', '当前橙色图标（对照）'],
];
const foundation = await readFile('src/components/arc/foundation.css', 'utf8');
const font = (await readFile('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64');
const figures = await Promise.all(choices.map(async ([id, set, name, label]) => {
  const { default: icon } = await import(`@iconify-icons/${set}/${name}`);
  const svg = size => `<svg width="${size}" height="${size}" viewBox="0 0 ${icon.width} ${icon.height}" aria-hidden="true">${icon.body}</svg>`;
  return `<figure><div class="cover">${svg(76)}</div><figcaption><h2>${id} · ${label}</h2><p>${set} / ${name}</p><div class="sizes">${svg(18)}<span>Image</span>${svg(24)}<span>24px</span></div></figcaption></figure>`;
}));
const html = `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StashDock 图片图标候选</title><style>${foundation}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:swap}
:root{--font-inter:Inter,"Segoe UI",sans-serif;--font-geist:Inter,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-body);font-size:var(--text-sm);line-height:var(--leading-body)}
main{max-width:1200px;margin:auto;padding:var(--space-6)}header{margin-bottom:var(--space-6)}h1{margin:0 0 var(--space-3);font-size:var(--text-2xl);font-weight:500}header p{margin:var(--space-2) 0;color:var(--text-secondary)}nav{display:flex;gap:var(--space-4);margin-top:var(--space-4)}a{color:var(--foreground);text-underline-offset:var(--space-1)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:var(--space-4)}figure{margin:0;padding:var(--space-2);border:1px solid var(--border);border-radius:var(--radius-panel);background:var(--surface)}
.cover{display:grid;place-items:center;aspect-ratio:16/9;background:var(--surface-muted);border-radius:calc(var(--radius-panel) - var(--space-2))}figcaption{padding:var(--space-4) var(--space-2)}h2{font-size:var(--text-base);font-weight:500;margin:0 0 var(--space-2)}figcaption p{color:var(--text-secondary);font-size:var(--text-xs);margin:0;overflow-wrap:anywhere}.sizes{display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-4);color:var(--text-secondary)}.sizes svg:nth-of-type(2){margin-inline-start:var(--space-4)}svg{display:block;flex:none}
</style></head><body data-arc-ui><main><header><h1>图片图标候选</h1><p>使用开源库原图，未修改颜色和路径。统一中性背景，便于比较图标本身。</p><p>每项展示封面尺寸与 18px / 24px 小图标。正式应用尚未替换。</p><nav aria-label="预览主题"><a href="?theme=light">浅色预览</a><a href="?theme=dark">深色预览</a></nav></header><div class="grid">${figures.join('')}</div></main><script>document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')==='dark'?'dark':'light';</script></body></html>`;
await mkdir('output/image-icon-options', { recursive: true });
await writeFile('output/image-icon-options/index.html', html);
console.log('Created output/image-icon-options/index.html (7 upstream options; no production changes).');
