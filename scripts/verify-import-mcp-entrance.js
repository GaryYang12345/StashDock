// Packaged UI over the real MCP SDK with an isolated library and host harness.
async page => {
  const errors = [], reports = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('https://example.org/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const app = page.frameLocator('iframe');
  await app.getByRole('article').nth(29).waitFor();
  await app.getByRole('button', { name: 'Load more references', exact: true }).click();
  await app.getByRole('article').nth(59).waitFor();
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await app.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; }, theme);
    await app.getByRole('button', { name: 'Import references', exact: true }).click();
    const dialog = app.getByRole('dialog'); await dialog.waitFor();
    for (const mode of ['Link', 'Note', 'File']) {
      await dialog.getByRole('tab', { name: mode, exact: true }).click();
      await page.waitForTimeout(800);
      const geometry = await dialog.evaluate(el => {
        const r = el.getBoundingClientRect(); return { bottom: r.bottom, top: r.top, height: innerHeight, scale: new DOMMatrixReadOnly(getComputedStyle(el).transform).a };
      });
      if (geometry.scale !== 1 || geometry.top < 14 || geometry.bottom > geometry.height - 14) throw Error('MCP geometry/scaling regression');
      const rect = await dialog.boundingBox(), save = await dialog.getByRole('button', { name: `Save ${mode.toLowerCase()}`, exact: true }).boundingBox();
      if (!rect || !save || save.y + save.height > rect.y + rect.height - 12) throw Error('MCP action clipped');
      reports.push({ theme, width, mode, actionsVisible: true });
    }
    if (width === 390) await page.screenshot({ path: `output/playwright/import-entrance-mcp-${theme}.png` });
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await dialog.waitFor({ state: 'detached' }); await app.getByRole('article').nth(59).waitFor();
    if (await app.getByRole('article').count() !== 60) throw Error('Dialog reset MCP pagination');
  }
  // Inert shelf and no optional background reads while the form is active.
  let reads = 0;
  page.on('request', req => { if (req.url().endsWith('/tool') && req.postDataJSON()?.name === 'list_stashdock_shelf') reads++; });
  await app.getByRole('button', { name: 'Import references', exact: true }).click();
  await app.getByRole('dialog').waitFor(); await page.waitForTimeout(300);
  const before = reads; await page.waitForTimeout(2600);
  if (reads !== before) throw Error('Passive reads competed with Import');
  await app.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await app.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(2400);
  if (reads <= before) throw Error('Passive reads did not resume after closing Import');
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, retainedPagination: 60, passiveReadsPausedAndResumed: true, pageErrors: 0, realLibraryWrites: 0, host: 'isolated harness, not actual ChatGPT UI' };
}
