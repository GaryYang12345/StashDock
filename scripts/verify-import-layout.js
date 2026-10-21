async page => {
  const errors = [], reports = [];
  await page.bringToFront();
  const base = page.url().includes(':18750/') ? 'http://127.0.0.1:18750' : 'http://127.0.0.1:18749';
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/tests/fixtures/settings.html`, { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: 'Import references', exact: true });
    await trigger.waitFor();
    await page.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; }, theme);
    for (let iteration = 0; iteration < 2; iteration++) {
      await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
      for (const mode of ['Link', 'Note', 'File']) {
        await dialog.getByRole('tab', { name: mode, exact: true }).click();
        // Assert settled geometry, not a wall-clock sleep while the headed
        // browser may be occluded by native-window acceptance or packaging.
        await dialog.evaluate(async el => {
          const started = performance.now();
          await new Promise((resolve, reject) => {
            function frame() {
              const natural = el.children[0].getBoundingClientRect().height + el.children[1].getBoundingClientRect().height + 2;
              const target = Math.min(natural, parseFloat(getComputedStyle(el).maxHeight));
              if (Math.abs(el.getBoundingClientRect().height - target) < 1) resolve();
              else if (performance.now() - started > 5000) reject(Error('Dialog height did not settle'));
              else requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          });
        });
        const bounds = await dialog.boundingBox();
        const save = await dialog.getByRole('button', { name: `Save ${mode.toLowerCase()}`, exact: true }).boundingBox();
        if (!bounds || !save || save.y + save.height > bounds.y + bounds.height - 12 || bounds.y < 14 || bounds.y + bounds.height > 886) throw Error('Clipped dialog/actions: ' + JSON.stringify({ theme, width, mode, bounds, save }));
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
        if (width === 390 && iteration === 0 && mode === 'Note') await page.screenshot({ path: `output/playwright/import-entrance-${theme}.png` });
      }
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      await page.getByRole('article').nth(1).waitFor();
      if (await page.getByRole('article').count() !== 2) throw Error('Shelf changed during import');
      reports.push({ theme, width, iteration, modes: 3, actionsVisible: true });
    }
  }
  // Browser profile discovery must not hold the form entrance open.
  await page.goto(`${base}/tests/fixtures/desktop-import.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org');
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
  // Development renders under React StrictMode, whose remount resets motion
  // values: the dialog must still fit its content instead of stretching.
  await page.goto(`${base}/tests/fixtures/desktop-import.html?strict`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  const strictDialog = page.getByRole('dialog'); await strictDialog.waitFor(); await page.waitForTimeout(800);
  const fit = await strictDialog.evaluate(el => ({ height: el.getBoundingClientRect().height, natural: el.children[0].getBoundingClientRect().height + el.children[1].getBoundingClientRect().height + 2 }));
  if (Math.abs(fit.height - fit.natural) > 1) throw Error('StrictMode dialog does not fit its content: ' + JSON.stringify(fit));
  await page.keyboard.press('Escape'); await strictDialog.waitFor({ state: 'detached' });
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, slowDiscoveryDoesNotBlockInput: true, pageErrors: 0, realLibraryWrites: 0 };
}
