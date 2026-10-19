async page => {
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.addInitScript(() => localStorage.setItem('stashdock.items.v1', JSON.stringify(Array.from({ length: 3 }, (_, i) => ({
    id: 'simple-' + i, title: 'Source card ' + i, kind: 'note', source: 'Note', content: 'Fixture context', tags: [], createdAt: '2026-10-13',
  })))));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.locator('article').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 2; i++) {
    const card = page.locator('article').nth(i);
    await card.hover(); await card.getByRole('button', { name: /^Add .* to context$/ }).click();
  }
  await page.getByRole('region', { name: 'Selected references' }).waitFor();
  await page.waitForTimeout(450);
  const rasters = await page.evaluate(async () => {
    const { referenceDragPreview } = await import('/src/lib/reference-drag.ts');
    const items = [{ id: 'simple-0', title: 'Source card 0', kind: 'note', source: 'Note', tags: [] }];
    const results = [];
    for (const [name, selector] of [['bar', '[aria-label="Selected references"]'], ['card', 'article']]) {
      const source = document.querySelector(selector), started = performance.now();
      const canvas = referenceDragPreview(source, items), png = canvas.toDataURL('image/png');
      results.push({ name, width: canvas.width, height: canvas.height, sourceWidth: source.offsetWidth, sourceHeight: source.offsetHeight, ms: performance.now() - started, png });
      if (name === 'bar') {
        if (canvas.width !== source.offsetWidth || canvas.height !== source.offsetHeight) throw Error('Bar size mismatch');
        const status = source.querySelector('[role="status"]'); status.textContent = '3 selected';
        if (referenceDragPreview(source, items).toDataURL() === png) throw Error('The bar did not paint its current count');
        status.textContent = '2 selected';
      } else if (canvas.width !== 320 || canvas.height !== 112) throw Error('Original card drag size changed');
    }
    return results;
  });
  for (const raster of rasters) {
    if (raster.ms > 50) throw Error('Synchronous preview too slow: ' + raster.ms);
    const download = page.waitForEvent('download');
    await page.evaluate(({ png, name }) => { const a = document.createElement('a'); a.href = png; a.download = 'simple-' + name + '.png'; a.click(); }, raster);
    await (await download).saveAs('output/playwright/simple-' + raster.name + '.png');
    delete raster.png;
  }
  const responsive = [];
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const result = await page.evaluate(async () => {
        const { referenceDragPreview } = await import('/src/lib/reference-drag.ts');
        const source = document.querySelector('[aria-label="Selected references"]');
        const canvas = referenceDragPreview(source, [{ id: 'simple-0', title: 'Wrong first card', tags: [] }]);
        return { width: canvas.width, height: canvas.height, sourceWidth: source.offsetWidth, sourceHeight: source.offsetHeight };
      });
      if (result.width !== result.sourceWidth || result.height !== result.sourceHeight) throw Error('Responsive bar dimensions differ');
      responsive.push({ viewport: width, theme, ...result });
    }
  }
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  // Native show/hide is checked against the packaged app separately.
  return { rasters, responsive };
}
