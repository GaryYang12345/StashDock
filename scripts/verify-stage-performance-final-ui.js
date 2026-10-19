async page => {
  const errors = [], reports = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
    const open = page.getByRole('button', { name: 'Import references', exact: true });
    await open.waitFor(); await open.hover();
    await page.locator('html').evaluate((el, t) => { el.dataset.theme = t; }, theme);
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Import references', exact: true });
    await dialog.waitFor(); await page.waitForTimeout(1000);
    const bounds = await dialog.boundingBox(), save = await dialog.getByRole('button', { name: 'Save link', exact: true }).boundingBox();
    if (!bounds || !save || save.y + save.height > bounds.y + bounds.height - 12) throw Error('Save clipped after settling');
    if (width === 390) await page.screenshot({ path: `output/playwright/stage-perf-import-${theme}.png` });
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('article').nth(1).waitFor();
    reports.push({ theme, width, settledSaveVisible: true });
  }
  await page.route('https://example.org/**', route => route.fulfill({ status: 404, body: '' }));
  let reads = 0;
  page.on('request', request => { if (request.url().endsWith('/tool') && request.postDataJSON()?.name === 'list_stashdock_shelf') reads++; });
  await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const mcp = page.frameLocator('iframe');
  await mcp.getByRole('article').nth(29).waitFor();
  await page.waitForTimeout(2300);
  if (reads < 2) throw Error('Pending-icon refresh was not exercised');
  await mcp.getByRole('button', { name: 'Import references', exact: true }).click();
  await mcp.getByRole('dialog', { name: 'Import references', exact: true }).waitFor();
  await page.waitForTimeout(300);
  const before = reads; await page.waitForTimeout(2600);
  if (reads !== before) throw Error('Passive refresh competed with the import dialog');
  await mcp.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await mcp.getByRole('article').nth(29).waitFor();
  await page.waitForTimeout(2300);
  if (reads <= before) throw Error('Passive refresh did not resume after closing');
  await mcp.getByRole('button', { name: 'Load more references', exact: true }).click();
  await mcp.getByRole('article').nth(59).waitFor();
  await mcp.getByRole('button', { name: 'Refresh library', exact: true }).click();
  await page.waitForTimeout(500);
  if (await mcp.getByRole('article').count() !== 60) throw Error('Refresh lost loaded pages');
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, passiveRefreshPausesAndResumes: true, pagination: 60, pageErrors: 0, realLibraryWrites: 0 };
}
