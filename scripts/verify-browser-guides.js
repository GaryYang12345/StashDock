async page => {
  const reports = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const host of ['desktop', 'mcp']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(host === 'desktop' ? 'http://127.0.0.1:18749/tests/fixtures/settings.html' : 'http://127.0.0.1:18747/?locale=en-US&theme=' + theme, { waitUntil: 'domcontentloaded' });
    const scope = host === 'desktop' ? page : page.frameLocator('iframe');
    await scope.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await scope.locator('html').evaluate((element, theme) => { element.dataset.theme = theme; }, theme);
    for (const [id, brand] of [['edge', 'Edge'], ['firefox', 'Firefox']]) {
      const row = scope.locator(`[data-integration-row="${id}"]`);
      if (await row.getByText('Coming soon', { exact: true }).count()) throw Error(brand + ' is still a placeholder');
      await row.getByRole('button', { name: 'Set up ' + brand, exact: true }).click();
      const dialog = scope.getByRole('dialog', { name: 'Set up ' + brand, exact: true });
      await dialog.waitFor();
      if (!await dialog.getByText(`Install the extension in ${brand}.`, { exact: true }).count()) throw Error('Wrong install brand');
      if (await dialog.getByText('Install the extension in Chrome.', { exact: true }).count()) throw Error('Leaked Chrome copy');
      const launch = dialog.getByRole('button', { name: 'Open ' + brand, exact: true });
      await launch.click();
      if (host === 'desktop') await page.waitForFunction(id => document.documentElement.dataset.openedIntegration === id, id, { timeout: 5000 });
      if (host === 'desktop' && await scope.locator('html').getAttribute('data-opened-integration') !== id) throw Error('Wrong app opened');
      const overflow = await dialog.evaluate(element => element.scrollWidth > element.clientWidth + 1);
      if (overflow) throw Error('Dialog overflow at ' + width);
      if (width === 390) await page.screenshot({ path: `output/playwright/browser-guide-${host}-${theme}-${id}.png` });
      await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
    }
    if (width === 390) await page.screenshot({ path: `output/playwright/browser-guides-${host}-${theme}.png` });
    reports.push({ host, theme, width });
  }
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html?browsers-detected', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  for (const id of ['edge', 'firefox']) {
    const row = page.locator(`[data-integration-row="${id}"]`);
    await row.getByRole('button', { name: /^View guide/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Save pages from ' + (id === 'edge' ? 'Edge' : 'Firefox'), exact: true }).waitFor();
    if (await dialog.getByText('Install the extension', { exact: false }).count()) throw Error('Usage guide shows setup steps');
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, detectedGuides: true, pageErrors: errors.length, realApplicationsOpened: false };
}
