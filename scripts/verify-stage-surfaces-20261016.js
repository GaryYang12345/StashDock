async page => {
  const errors = [], reports = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const surface of ['desktop', 'mcp']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(surface === 'desktop' ? 'http://127.0.0.1:18749/tests/fixtures/dashboard-polish.html' : 'http://127.0.0.1:18747/?locale=en-US', { waitUntil: 'domcontentloaded' });
    const scope = surface === 'desktop' ? page : page.frameLocator('iframe');
    await scope.getByRole('article').first().waitFor();
    await scope.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; el.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    const count = await scope.getByRole('article').count();
    for (const view of ['List', 'Grid']) {
      await scope.getByRole('button', { name: view, exact: true }).click();
      if (await scope.getByRole('article').count() !== count) throw Error('View change lost references');
    }
    if (await scope.locator('html').evaluate(el => el.scrollWidth > innerWidth)) throw Error(surface + ' overflow at ' + width);
    const invalid = await scope.locator('button[data-icon-only]').evaluateAll(buttons => buttons.filter(el => {
      if (!el.getClientRects().length) return false;
      const rect = el.getBoundingClientRect();
      return Math.abs(rect.width - rect.height) > .5 || getComputedStyle(el).borderRadius !== '50%';
    }).map(el => el.getAttribute('aria-label')));
    if (invalid.length) throw Error(surface + ' non-circular controls: ' + invalid.join(', '));
    if (width === 390) await page.screenshot({ path: `output/playwright/stage-1016-${surface}-${theme}.png` });
    reports.push({ surface, theme, width, references: count });
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, pageErrors: errors.length };
}
