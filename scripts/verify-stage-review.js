// Three rendered surfaces with test-only services/data, never the user's composer.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const reports = [];
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18531/tests/fixtures/dashboard-polish.html');
    await page.getByRole('article').first().waitFor();
    await page.locator('html').evaluate((node, value) => { node.dataset.theme = value; }, theme);
    for (const view of ['List', 'Grid']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      if (await page.getByRole('article').count() !== 3) throw Error('Dashboard card tree changed');
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Dashboard overflow');
    if (width === 390) await page.screenshot({ path: `output/playwright/stage-desktop-${theme}.png` });
    reports.push({ surface: 'desktop fixture', theme, width });
  }
  for (const theme of ['light', 'dark']) for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18531/tests/fixtures/save-sidebar.html');
    await page.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
    await page.locator('html').evaluate((node, value) => { node.dataset.theme = value; }, theme);
    await page.waitForFunction(() => window.sidebarFixture.tagReads === 1);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('User-edited title');
    await page.evaluate(() => { window.sidebarFixture.mode = 'read-error'; });
    await page.getByRole('button', { name: 'Refresh page', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Page could not be read' }).waitFor();
    if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'User-edited title') throw Error('Refresh replaced user edits');
    await page.evaluate(() => { window.sidebarFixture.mode = ''; });
    await page.getByRole('button', { name: 'Refresh page', exact: true }).click();
    await page.waitForFunction(() => window.sidebarFixture.tagReads === 2);
    await page.evaluate(() => { window.sidebarFixture.mode = 'save-error'; });
    await page.getByRole('button', { name: 'Save page', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Page could not be saved' }).waitFor();
    await page.evaluate(() => { window.sidebarFixture.mode = ''; });
    await page.getByRole('button', { name: 'Save page', exact: true }).click();
    await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
    await page.getByRole('alert').waitFor({ state: 'hidden' });
    if (await page.evaluate(() => window.sidebarFixture.closes)) throw Error('Save closed the sidebar');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Sidebar overflow');
    if (width === 390) await page.screenshot({ path: `output/playwright/stage-sidebar-${theme}.png` });
    reports.push({ surface: 'save sidebar fixture', theme, width, readSaveFailures: true });
  }
  await page.goto('http://127.0.0.1:18751/');
  const mcp = page.frameLocator('iframe');
  await mcp.getByRole('article').nth(29).waitFor();
  await mcp.getByRole('button', { name: 'Load more references', exact: true }).click();
  await mcp.getByRole('article').nth(59).waitFor();
  await mcp.getByRole('button', { name: 'Refresh library', exact: true }).click();
  await page.waitForTimeout(500);
  if (await mcp.getByRole('article').count() !== 60) throw Error('MCP refresh collapsed pagination');
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await mcp.locator('html').evaluate((node, value) => { node.dataset.theme = value; }, theme);
    for (const view of ['List', 'Grid']) await mcp.getByRole('button', { name: view, exact: true }).click();
    if (await mcp.locator('html').evaluate(node => node.scrollWidth > innerWidth)) throw Error('MCP overflow');
    if (width === 390) await page.screenshot({ path: `output/playwright/stage-mcp-${theme}.png` });
    reports.push({ surface: 'packaged MCP harness', theme, width, pagination: 60 });
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, consoleErrors: errors.length };
}
