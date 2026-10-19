async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const help = page.getByRole('button', { name: 'About storage location', exact: true });
  const explanation = page.getByText('Shared by StashDock Desktop and AI plugins on this device.', { exact: true });
  if (await explanation.count()) throw Error('Storage explanation is not collapsed');
  const before = await help.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
  await help.hover(); await explanation.waitFor();
  const after = await help.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, transform: getComputedStyle(el).transform, cursor: getComputedStyle(el).cursor }));
  if (before.background !== after.background || after.background !== 'rgba(0, 0, 0, 0)' || after.transform !== 'none' || after.color === before.color) throw Error('Help hover must change only foreground');
  if (after.cursor !== 'pointer') throw Error('System help cursor remains');
  const tooltip = page.getByRole('tooltip');
  if (await tooltip.evaluate(el => getComputedStyle(el).backgroundColor) !== 'rgb(13, 13, 13)') throw Error('Help is not the shared black tooltip');
  if (await help.getAttribute('aria-haspopup')) throw Error('Help still opens a popover');
  await page.keyboard.press('Escape'); await tooltip.waitFor({ state: 'hidden' });
  await page.mouse.move(0, 0); await help.focus(); await tooltip.waitFor();
  await page.keyboard.press('Escape'); await tooltip.waitFor({ state: 'hidden' });
  if (!await help.evaluate(el => el === document.activeElement)) throw Error('Tooltip dismissal stole focus');
  for (const [section, copy] of [['Browser extensions', 'Save pages while you browse.'], ['AI plugins', 'Browse your library and use references as context in conversations.']]) {
    const sectionHelp = page.getByRole('button', { name: `About ${section}`, exact: true });
    await sectionHelp.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
    await sectionHelp.hover(); await tooltip.filter({ hasText: copy }).waitFor();
    if (await tooltip.innerText() !== copy) throw Error('Incorrect approved purpose: ' + section);
    await page.keyboard.press('Escape');
  }
  const installed = page.locator('[data-integration-row="codex"]');
  const guide = installed.getByRole('button', { name: 'View guide for ChatGPT', exact: true });
  await installed.getByText('Detected', { exact: true }).waitFor();
  await guide.click();
  const dialog = page.getByRole('dialog', { name: 'Use references in ChatGPT', exact: true });
  await dialog.waitFor();
  if (await dialog.locator('ol').evaluate(el => getComputedStyle(el).listStyleType) !== 'decimal') throw Error('Desktop reset hid guide step numbers');
  if (await dialog.getByRole('listitem').count() !== 3 || await dialog.getByRole('button', { name: 'Open installation page' }).count()) throw Error('Usage guide contains installation or is incomplete');
  await dialog.getByText('Click Add to chat for your selection, then write your question.', { exact: true }).waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  if (!await guide.evaluate(el => el === document.activeElement)) throw Error('Guide did not return focus');
  if (await installed.getByRole('button').count() !== 1 || await page.getByText(/^(Configured|In use)$/).count()) throw Error('Old integration presentation remains');
  for (const theme of ['light', 'dark']) for (const width of [390,768,1024,1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    await help.scrollIntoViewIfNeeded();
    if (await page.locator('[data-settings-view]').evaluate(el => el.scrollWidth > el.clientWidth)) throw Error('Overflow ' + width);
    await page.screenshot({ path: `output/playwright/settings-refined-storage-${theme}-${width}.png` });
  }
  const about = page.locator('section[aria-labelledby="settings-about"]');
  await about.getByText('StashDock Desktop', { exact: true }).scrollIntoViewIfNeeded();
  if (!await about.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)) throw Error('Desktop About mark missing');
  await page.locator('[data-integration-row="codex"]').getByText('ChatGPT', { exact: true }).waitFor();
  if (await page.getByText('Not detected', { exact: true }).count()) throw Error('Unknown connection is labelled absent');
  await page.getByRole('button', { name: 'Set up Chrome', exact: true }).click();
  await page.getByText('Install the extension to save pages from Chrome.', { exact: true }).waitFor();
  if (await page.getByText(/No pairing|Every StashDock app|No desktop app/).count()) throw Error('Redundant guidance remains');
  await page.keyboard.press('Escape');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Approved help copy, normal pointer, black hover/focus hints, Detected/View guide, meaningful usage, Escape/focus return and eight theme/width layouts passed.');
}
