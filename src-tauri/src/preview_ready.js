// Public-preview viewport probe. Bounded sampling, no DOM mutation, no page text
// crosses the renderer boundary. Native code owns polling, stability and timeout.
(() => {
  const body = document.body;
  if (!body) return { ready: false };
  const width = innerWidth, height = innerHeight;
  const visible = node => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < height && r.left < width;
  };
  const images = Array.from(document.images).slice(0, 256).filter(visible);
  const pending = images.some(image => !image.complete);
  const busy = Array.from(document.querySelectorAll('[aria-busy="true"]')).slice(0, 64).some(visible);
  const text = (body.innerText || '').trim().slice(0, 16000);
  const media = images.some(image => image.complete && image.naturalWidth > 0)
    || Array.from(document.querySelectorAll('canvas,svg,video')).slice(0, 64).some(visible);
  let signature = 2166136261;
  const hash = value => { for (let i = 0; i < value.length; i++) signature = Math.imul(signature ^ value.charCodeAt(i), 16777619); };
  hash(text);
  // Viewport hit-testing catches late layout/hero changes without walking the
  // entire DOM, and ignores offscreen carousels/analytics/long-lived requests.
  for (let y = 80; y < height; y += 160) for (let x = 80; x < width; x += 240) {
    const node = document.elementFromPoint(x, y);
    if (!node) continue;
    const r = node.getBoundingClientRect();
    hash(`${node.tagName}:${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`);
  }
  for (const image of images) hash(`${image.currentSrc}:${image.complete}:${image.naturalWidth}`);
  const drawable = Boolean(text || media);
  // A blocked external script can leave readyState at "loading" after useful
  // content has already painted. Keep drawability separate from full readiness
  // so the bounded native fallback can capture that page, never an empty one.
  return { drawable, ready: Boolean(document.readyState !== 'loading' && drawable && !pending && !busy && document.fonts?.status !== 'loading'), signature: signature >>> 0 };
})()
