export const layoutIds = ['anti-defensive', 'sft-rl-opd', 'design-spells', 'plot-color', 'seeco', 'korea-artist', 'oregon-101', 'uiverse'] as const;
export type LayoutId = typeof layoutIds[number];
export type CardPlacement = { id: LayoutId; x: number; y: number; scale: number; rotation: number; z: number };
export type FadePlacement = { start: number; height: number; strength: number };
export type HeroLayout = { version: 1; canvas: { width: number; height: number }; cards: CardPlacement[]; fade: FadePlacement };
export const layoutStorageKey = 'stashdock-hero-layout-editor-v1';
export const bounds = { x: [-6000, 6000], y: [-2000, 6000], scale: [.2, 2], rotation: [-180, 180], z: [0, 99] } as const;
export const fadeBounds = { start: [-2000, 6000], height: [1, 4000], strength: [0, 100] } as const;
export function defaultFade(canvas: HeroLayout['canvas']): FadePlacement {
  const height = canvas.width <= 1100 ? 120 : 220;
  return { start: canvas.height - height, height, strength: 100 };
}
export function fadeValue(key: keyof FadePlacement, value: number) {
  const [min, max] = fadeBounds[key];
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}
export function placementValue(key: keyof typeof bounds, value: number) {
  const [min, max] = bounds[key];
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function parseLayout(text: string): HeroLayout {
  const input = JSON.parse(text);
  if (input?.version !== 1 || !Number.isFinite(input.canvas?.width) || !Number.isFinite(input.canvas?.height)
    || input.canvas.width < 100 || input.canvas.width > 10000 || input.canvas.height < 100 || input.canvas.height > 10000
    || !Array.isArray(input.cards) || input.cards.length !== layoutIds.length) throw Error('请选择此调整页导出的 JSON 文件。');
  // The owner replaced the first reference; old drafts retain its exact geometry.
  const inputCards = input.cards.map((value: { id?: unknown }) => value?.id === 'arc-ui' ? { ...value, id: 'anti-defensive' } : value);
  const cards = layoutIds.map(id => {
    const card = inputCards.filter((value: { id?: unknown }) => value?.id === id);
    if (card.length !== 1) throw Error('布局中的卡片不完整。');
    const result: CardPlacement = { id, x: 0, y: 0, scale: 1, rotation: 0, z: 0 };
    for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
      if (!Number.isFinite(card[0][key]) || placementValue(key, card[0][key]) !== card[0][key]) throw Error('布局参数超出可调整范围。');
      result[key] = card[0][key];
    }
    return result;
  });
  const canvas = { width: input.canvas.width, height: input.canvas.height };
  // Previous exports/drafts had only card geometry. Keep every card unchanged.
  const fade = defaultFade(canvas);
  if (input.fade !== undefined) {
    if (!input.fade || typeof input.fade !== 'object') throw Error('渐隐参数无效。');
    for (const key of Object.keys(fadeBounds) as (keyof FadePlacement)[]) {
      const value = input.fade[key];
      if (!Number.isFinite(value) || fadeValue(key, value) !== value) throw Error('渐隐参数超出可调整范围。');
      fade[key] = value;
    }
  }
  return { version: 1, canvas, cards, fade };
}

// X is the unscaled paper centre, relative to the canvas centre. Y is the
// unscaled paper top, relative to the artwork. Values are CSS pixels.
export function layoutCss(layout: HeroLayout) {
  const fade = layout.fade ?? defaultFade(layout.canvas);
  const mask = `.layout-canvas .hero-references{mask-image:linear-gradient(to bottom,black ${fade.start}px,oklch(0% 0 0 / ${1 - fade.strength / 100}) ${fade.start + fade.height}px);}`;
  return mask + '\n' + layout.cards.map(card => `.layout-canvas [data-hero-reference="${card.id}"]{display:block;left:calc(50% + ${card.x}px - 150px);right:auto;top:${card.y}px;bottom:auto;transform:rotate(${card.rotation}deg) scale(${card.scale});z-index:${card.z};}`).join('\n');
}
