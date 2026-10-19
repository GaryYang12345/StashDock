// Dedicated mcp-test database; never point this at a live host composer.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:18747/');
  const ui = page.frameLocator('iframe');
  await ui.getByRole('article').first().waitFor();
  await ui.getByRole('button', {name: 'Load more references', exact: true}).click();
  await ui.getByRole('article').nth(59).waitFor({state: 'attached', timeout: 10_000});
  if (await ui.getByRole('article').count() !== 60) throw Error('Pagination fixture did not load: ' + await ui.getByRole('article').count());
  await ui.getByRole('button', {name: 'Refresh library', exact: true}).click(); await page.waitForTimeout(600);
  if (await ui.getByRole('article').count() !== 60) throw Error('Refresh collapsed loaded pages');
  await ui.locator('html').evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(600);
  if (await ui.getByRole('article').count() !== 60) throw Error('Focus collapsed loaded pages');
  for (const theme of ['light', 'dark']) for (const width of [320, 439, 768, 1063]) {
    await page.setViewportSize({width, height: 900});
    await ui.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; }, theme);
    await ui.getByRole('button', {name: 'Grid', exact: true}).click();
    const grid = ui.getByRole('article').first().locator('..');
    const columns = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    if (columns !== (width < 380 ? 1 : width < 720 ? 2 : 3)) throw Error('Card columns ' + width + ': ' + columns);
    const cards = ui.getByRole('article');
    for (const i of [0, 1, 2, 0]) {
      await cards.nth(i).locator('[data-card-menu]').click(); await page.waitForTimeout(180);
      if (await ui.getByRole('menu').count() !== 1 || await ui.locator('article[data-menu-open]').count() !== 1) throw Error('MCP competing menus');
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(180);
    await ui.getByRole('button', {name: 'List', exact: true}).click();
    const heights = await cards.evaluateAll(rows => rows.slice(0, 10).map(el => el.getBoundingClientRect().height));
    if (heights.some(height => Math.abs(height - 84) > 1)) throw Error('List heights ' + heights.join(','));
    if (await ui.locator('html').evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('MCP horizontal overflow');
    if (width === 439) await ui.locator('body').screenshot({path: `output/playwright/mcp-audit-${theme}-0421.png`});
  }
  await page.setViewportSize({width: 1063, height: 900});
  await ui.getByRole('button', {name: 'Tags', exact: true}).click();
  for (const name of ['Research', 'Design', 'Research']) {
    await ui.getByRole('menuitemradio', {name: `Filter by ${name}`, exact: true}).click({button: 'right'});
    await page.waitForTimeout(200);
    if (await ui.getByRole('menu', {name: /^Actions for tag /}).count() !== 1 || !await ui.getByRole('menu', {name: `Actions for tag ${name}`, exact: true}).isVisible()) throw Error('MCP context reopen: ' + name);
  }
  await ui.getByRole('menuitem', {name: 'Rename tag', exact: true}).click();
  await ui.getByRole('dialog', {name: 'Rename tag', exact: true}).waitFor();
  if (await ui.getByRole('menu').count()) throw Error('Menu remains in tag dialog');
  await ui.getByRole('button', {name: 'Close dialog', exact: true}).click();
  await ui.getByRole('dialog').waitFor({state: 'hidden'});
  if (errors.length) throw Error(errors.join('\n'));
  return {paginationRefreshPreserved: true, focusPreserved: true, themeWidthChecks: 8, responsiveCards: true, equalListRows: true, cardMenuExclusive: true, contextMenuReopen: true};
}
