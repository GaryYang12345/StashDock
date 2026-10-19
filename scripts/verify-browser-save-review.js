// Rendered regression on isolated services only. No user library/host writes.
async page => {
  const errors = [], reports = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?provider=1&mode=offline');
    await page.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    if (await page.getByRole('button', { name: 'Settings', exact: true }).count()) throw Error('Unexpected Settings entry');
    if (!await page.getByRole('button', { name: 'Save page', exact: true }).isDisabled()) throw Error('Offline Save enabled');
    const refresh = page.getByRole('button', { name: 'Refresh page', exact: true });
    await refresh.hover();
    const circle = await refresh.evaluate(el => { const css = getComputedStyle(el); return { width: el.offsetWidth, height: el.offsetHeight, radius: css.borderRadius }; });
    if (circle.width !== circle.height || circle.radius !== '50%') throw Error('Refresh hover is not circular: ' + JSON.stringify(circle));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Sidebar overflow');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Retained title');
    await page.evaluate(() => { window.sidebarFixture.mode = ''; });
    await page.getByRole('button', { name: 'Check again', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'hidden' });
    if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Retained title') throw Error('Connectivity recovery lost draft');
    await page.getByRole('button', { name: 'Save page', exact: true }).click();
    await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
    if (await page.evaluate(() => window.sidebarFixture.closes)) throw Error('Save closed sidebar');
    if (width === 390) await page.screenshot({ path: `output/playwright/save-review-${theme}.png` });
    reports.push({ theme, width, circle, recovery: true });
  }
  await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?mode=deferred-save');
  await page.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.sidebarFixture.finishSave));
  const before = await page.evaluate(() => window.sidebarFixture.captures);
  await page.evaluate(() => { window.sidebarFixture.unmount(); window.sidebarFixture.finishSave(); });
  await page.waitForTimeout(100);
  if (await page.evaluate(() => window.sidebarFixture.captures) !== before) throw Error('Save completion read after unmount');
  await page.goto('http://127.0.0.1:18749/tests/fixtures/save-sidebar.html?mode=deferred-save');
  await page.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.sidebarFixture.finishSave));
  await page.evaluate(() => { window.sidebarFixture.navigate(); window.sidebarFixture.finishSave(); });
  await page.waitForFunction(() => window.sidebarFixture.captures >= 3);
  await page.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
  if (await page.getByRole('button', { name: 'Saved', exact: true }).count()) throw Error('Stale Saved state applied after navigation');
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, unmountedSaveDoesNotRecapture: true, navigationDuringCommitRecovers: true, pageErrors: errors.length };
}
