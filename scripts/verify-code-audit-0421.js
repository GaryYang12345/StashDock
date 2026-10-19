// Rendered checks on isolated fixtures only; never mutate the real library.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/tests/fixtures/dashboard-polish.html');
  const results = [];
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; }, theme);
    await page.waitForTimeout(220);
    const pane = page.locator('main > div > section');
    const shadow = await pane.evaluate(el => getComputedStyle(el).boxShadow);
    if (shadow === 'none' || !shadow.includes('18px') && !shadow.includes('22px')) throw Error('Missing raised content shadow');
    for (const name of ['Minimize to folder', 'Hide StashDock']) {
      const button = page.getByRole('button', {name, exact: true});
      await page.mouse.move(0, 0); await page.waitForTimeout(170);
      const idle = await button.evaluate(el => getComputedStyle(el).backgroundColor);
      await button.hover(); await page.waitForTimeout(170);
      const shape = await button.evaluate(el => { const s = getComputedStyle(el); return {radius: parseFloat(s.borderRadius), width: el.offsetWidth, height: el.offsetHeight, fill: s.backgroundColor}; });
      if (shape.width !== shape.height || shape.radius < shape.height / 2 || shape.fill === idle) throw Error('Window control shape/state ' + JSON.stringify(shape));
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Dashboard overflow');
    if (width === 1440) await page.screenshot({path: `output/playwright/dashboard-${theme}-0421.png`});
    results.push({theme, width, shadow});
  }
  await page.setViewportSize({width: 1440, height: 900});
  const tags = page.getByRole('button', {name: 'Tags (3)', exact: true}); await tags.click();
  for (const name of ['Research', 'Design', 'Research']) {
    await page.getByRole('button', {name: new RegExp('^' + name + ' ')}).click({button: 'right'});
    await page.waitForTimeout(200);
    if (await page.getByRole('menu').count() !== 1 || !await page.getByRole('menu', {name: `Actions for tag ${name}`, exact: true}).isVisible()) throw Error(`Superseded context menu did not reopen: ${name}; count=${await page.getByRole('menu').count()}`);
  }
  const cards = page.getByRole('article');
  for (const i of [0, 1, 2, 0]) {
    await cards.nth(i).locator('[data-card-menu]').click(); await page.waitForTimeout(200);
    if (await page.getByRole('menu').count() !== 1 || await page.locator('article[data-menu-open]').count() !== 1) throw Error('Competing menus or hover state');
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (await page.getByRole('menu').count() || await page.locator('article[data-menu-open]').count()) throw Error('Stale menu after Escape');
  await page.getByRole('button', {name: /^Research /}).click({button: 'right'});
  await page.getByRole('menu', {name: 'Actions for tag Research', exact: true}).waitFor();
  await page.keyboard.press('Escape');
  if (errors.length) throw Error(errors.join('\n'));
  return {themeWidths: results, contextMenuReopen: true, cardMenuExclusive: true, escapeCleanup: true};
}
