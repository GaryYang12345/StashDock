// Actual rendered components and isolated IPC, no live collection writes.
async page => {
  const errors = [], reports = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: 'Import references', exact: true });
    await trigger.waitFor();
    await page.locator('html').evaluate((node, theme) => { node.dataset.theme = theme; }, theme);
    await trigger.hover();
    await page.waitForTimeout(150);
    for (let n = 0; n < 3; n++) {
      const started = Date.now(); await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Import references', exact: true });
      await dialog.waitFor();
      const openedMs = Date.now() - started;
      await dialog.getByRole('tab', { name: 'Note', exact: true }).click();
      await dialog.getByRole('textbox', { name: 'Content', exact: true }).fill('Unsaved draft. No real writes.');
      await dialog.getByRole('tab', { name: 'File', exact: true }).click();
      await dialog.getByRole('button', { name: 'Save file', exact: true }).waitFor();
      await dialog.getByRole('tab', { name: 'Link', exact: true }).click();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Overflow');
      if (n === 0 && width === 390) {
        await page.waitForTimeout(750);
        const save = await dialog.getByRole('button', { name: 'Save link', exact: true }).boundingBox(), bounds = await dialog.boundingBox();
        if (!save || !bounds || save.y + save.height > bounds.y + bounds.height - 12) throw Error('Settled Save is clipped');
        await page.screenshot({ path: `output/playwright/stage-perf-import-${theme}.png` });
      }
      await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('article').nth(1).waitFor();
      if (await page.getByRole('article').count() !== 2) throw Error('Import remounted or changed the shelf');
      reports.push({ theme, width, iteration: n + 1, openedMs });
    }
  }
  // Packaged MCP frontend + real local library, isolated fixture backend.
  await page.goto('http://127.0.0.1:18747/?locale=en-US', { waitUntil: 'domcontentloaded' });
  const mcp = page.frameLocator('iframe');
  await mcp.getByRole('article').first().waitFor();
  const initial = await mcp.getByRole('article').count();
  await mcp.getByRole('button', { name: 'Load more references', exact: true }).click();
  await mcp.getByRole('article').nth(initial).waitFor();
  const loaded = await mcp.getByRole('article').count();
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await mcp.locator('html').evaluate((node, theme) => { node.dataset.theme = theme; }, theme);
    await mcp.getByRole('button', { name: 'Import references', exact: true }).click();
    await mcp.getByRole('dialog', { name: 'Import references', exact: true }).waitFor();
    await mcp.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await mcp.getByRole('dialog').waitFor({ state: 'detached' });
    await mcp.getByRole('button', { name: 'Refresh library', exact: true }).click();
    await page.waitForTimeout(400);
    if (await mcp.getByRole('article').count() !== loaded) throw Error('Refresh collapsed pagination');
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, mcpPagination: loaded, pageErrors: errors.length, realLibraryWrites: 0 };
}
