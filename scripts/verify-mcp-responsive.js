// Read-only layout verification in our isolated browser, not the user's chat.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:18747/');
  const frame = page.locator('iframe');
  const app = page.frameLocator('iframe');
  await app.getByRole('article').first().waitFor();
  const results = [];
  // Keep the outer browser wide: the embedded panel must own its breakpoints.
  for (const theme of ['light', 'dark']) {
    await app.locator('main').evaluate((_, theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.accent = theme === 'light' ? 'neutral' : 'blue';
    }, theme);
    for (const width of [320, 360, 379, 380, 390, 439.333, 600, 719, 720, 768, 900, 1024, 1440]) {
      await frame.evaluate((el, width) => { el.style.width = width + 'px'; }, width);
      const actual = await app.getByRole('main').evaluate(el => {
        const cards = Array.from(el.querySelectorAll('article')).slice(0, 6);
        const boxes = cards.map(card => card.getBoundingClientRect());
        return {
          width: el.getBoundingClientRect().width,
          columns: boxes.filter(box => Math.abs(box.top - boxes[0].top) < 1).length,
          overflow: el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth,
          cardOverflow: cards.some(card => card.scrollWidth > card.clientWidth),
          controlsOutside: cards.some(card => {
            const box = card.getBoundingClientRect();
            return Array.from(card.querySelectorAll('button')).some(button => {
              const r = button.getBoundingClientRect();
              return r.left < box.left - 1 || r.right > box.right + 1;
            });
          }),
        };
      });
      const expected = actual.width >= 720 ? 3 : actual.width >= 380 ? 2 : 1;
      if (actual.columns !== expected || actual.overflow || actual.cardOverflow || actual.controlsOutside) {
        throw Error(JSON.stringify({ theme, requestedWidth: width, expected, ...actual }));
      }
      results.push({ theme, width: actual.width, columns: actual.columns });
      if ([360, 439.333, 900].includes(width)) {
        await frame.screenshot({ path: `output/playwright/mcp-047-${theme}-${Math.round(width)}.png` });
      }
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { outerWidth: 1440, panelOwnsBreakpoints: true, results, pageErrors: errors };
}
