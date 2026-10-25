import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['website/src/explorations/hero-layout.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { layoutIds, parseLayout, placementValue, layoutCss } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const sample = () => ({ version: 1, canvas: { width: 1440, height: 1060 }, fade: { start: 840, height: 220, strength: 100 }, cards: layoutIds.map((id, z) => ({ id, x: -300 + z * 100, y: 560, scale: .8, rotation: -8, z })) });
const approvedBundle = await build({ entryPoints: ['website/src/hero-reference-layout.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { heroReferenceLayout } = await import('data:text/javascript;base64,' + Buffer.from(approvedBundle.outputFiles[0].text).toString('base64'));

test('production retains the exact owner-approved geometry, layer order and fade', () => {
  assert.deepEqual(parseLayout(JSON.stringify(heroReferenceLayout)), heroReferenceLayout);
  assert.deepEqual(heroReferenceLayout.canvas, { width: 1697, height: 1045 });
  assert.deepEqual(heroReferenceLayout.fade, { start: 729, height: 220, strength: 100 });
  assert.deepEqual(heroReferenceLayout.cards.map(({ x, y, scale, rotation, z }) => [x, y, scale, rotation, z]), [
    [-735.49, 745, .82, 10, 1], [-622.83, 568.34, .8, 7, 1],
    [-454.82, 703.01, .79, -5, 2], [409.79, 718.35, .78, 5, 6],
    [770.5, 528.33, .77, 8, 7], [-756.83, 470.3, .77, -8, 0],
    [588.5, 616.35, .76, -4, 6], [738.49, 779.66, .88, -5, 5],
  ]);
});

test('hero editor round-trips an eight-card layout without losing geometry or layers', () => {
  const input = sample();
  assert.deepEqual(parseLayout(JSON.stringify(input)), input);
  assert.match(layoutCss(input), /left:calc\(50% \+ -300px - 150px\)/);
  assert.match(layoutCss(input), /rotate\(-8deg\) scale\(0.8\);z-index:0/);
});

test('hero editor accepts only bounded numeric values and exactly the known cards', () => {
  for (const mutate of [
    layout => { layout.cards[0].x = '0;display:none'; },
    layout => { layout.cards[0].scale = 10; },
    layout => { layout.cards[0].id = 'unknown'; },
    layout => { layout.cards.push(layout.cards[0]); },
    layout => { layout.canvas.height = 0; },
    layout => { layout.fade.height = 0; },
    layout => { layout.fade.strength = 101; },
    layout => { layout.fade.start = '800px'; },
  ]) {
    const input = sample(); mutate(input);
    assert.throws(() => parseLayout(JSON.stringify(input)));
  }
  assert.equal(placementValue('scale', 3), 2);
  assert.equal(placementValue('rotation', -200), -180);
  assert.equal(placementValue('x', 24.123), 24.12);
});

test('older saved layouts keep every card when fade controls are added', () => {
  const previous = sample(); delete previous.fade;
  const upgraded = parseLayout(JSON.stringify(previous));
  assert.deepEqual(upgraded.cards, previous.cards);
  assert.deepEqual(upgraded.fade, { start: 840, height: 220, strength: 100 });
});

test('replacing Arc with the writing rule preserves previous drafts and exports', () => {
  const previous = sample();
  previous.cards[0] = { id: 'arc-ui', x: -604, y: 512, scale: .91, rotation: -12, z: 14 };
  const upgraded = parseLayout(JSON.stringify(previous));
  assert.deepEqual(upgraded.cards[0], { ...previous.cards[0], id: 'anti-defensive' });
  assert.deepEqual(upgraded.cards.slice(1), previous.cards.slice(1));
  assert.deepEqual(upgraded.fade, previous.fade);
  assert.ok(!layoutCss(upgraded).includes('arc-ui'));
});

test('fade position, height and strength round-trip and produce the live mask', () => {
  const input = sample(); input.fade = { start: 600, height: 340, strength: 65 };
  assert.deepEqual(parseLayout(JSON.stringify(input)), input);
  assert.match(layoutCss(input), /black 600px,oklch\(0% 0 0 \/ 0.35\) 940px/);
});
