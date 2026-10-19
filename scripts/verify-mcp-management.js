// Own isolated harness only. Never sends into or automates the real composer.
async page => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto('http://127.0.0.1:18747/'); await page.bringToFront();
  const app = page.frameLocator('iframe');
  const first = app.locator('article').first(); await first.waitFor();
  await first.hover();
  const favorite = first.getByRole('button', { name: /^(Favorite|Unfavorite) / });
  const wasFavorite = await favorite.getAttribute('aria-pressed') === 'true';
  const title = await first.locator('h3').innerText();
  await favorite.click();
  await first.getByRole('button', { name: wasFavorite ? /^Favorite / : /^Unfavorite /, pressed: !wasFavorite }).waitFor();
  await page.mouse.move(1, 1); await page.waitForTimeout(400);
  if (await first.locator('[class*="controls"]').evaluate(el => getComputedStyle(el).opacity) !== '0') throw Error('Favorite pins hover controls');
  await first.hover(); await first.getByRole('button', { name: /^Edit tags for / }).click();
  const dialog = app.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByRole('textbox', { name: 'Selected reference tags' }).fill('Management test');
  await dialog.getByRole('button', { name: 'Save tags', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Tags saved' }).waitFor();
  await dialog.getByRole('button', { name: 'Filter by Management test', exact: true }).locator('..').getByRole('button', { name: 'Rename', exact: true }).click();
  const rename = dialog.getByRole('textbox', { name: /^Rename / });
  await rename.fill('Renamed management tag');
  await dialog.getByRole('button', { name: 'Save name', exact: true }).click();
  await dialog.getByRole('button', { name: 'Filter by Renamed management tag', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Remove tag Renamed management tag', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove tag', exact: true }).click();
  await dialog.getByRole('button', { name: 'Filter by Renamed management tag', exact: true }).waitFor({ state: 'hidden' });
  // Restore a unique filtering fixture after testing global rename/removal.
  await dialog.getByRole('textbox', { name: 'Selected reference tags' }).fill('Management test');
  await dialog.getByRole('button', { name: 'Save tags', exact: true }).click();
  await dialog.getByRole('button', { name: 'Filter by Management test', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await app.getByRole('button', { name: 'Tags', exact: true }).click();
  await app.getByRole('menuitem', { name: 'Management test (1)', exact: true }).click();
  await page.waitForTimeout(500);
  if (await app.locator('article').count() !== 1 || await app.locator('article h3').innerText() !== title) throw Error('Tag filter does not select the saved reference');
  await app.getByRole('button', { name: 'Clear tag filter', exact: true }).click();
  await app.getByRole('button', { name: 'Import references', exact: true }).click();
  await app.getByRole('dialog').getByRole('tab', { name: 'Note', exact: true }).click();
  await app.getByRole('textbox', { name: 'Title', exact: true }).fill('UI management test note');
  await app.getByRole('textbox', { name: 'Content', exact: true }).fill('This is isolated test content, not a real user reference.');
  await app.getByRole('tabpanel', { name: 'Note', exact: true }).getByRole('textbox', { name: 'Tags (optional)', exact: true }).fill('Management test');
  await app.getByRole('button', { name: 'Save reference', exact: true }).click();
  await app.getByRole('dialog').waitFor({ state: 'hidden' });
  const note = app.locator('article').filter({ has: app.getByRole('heading', { name: 'UI management test note', exact: true }) });
  await note.waitFor(); await note.hover();
  await note.getByRole('button', { name: 'Delete UI management test note', exact: true }).click();
  const deletion = app.getByRole('dialog');
  await deletion.getByRole('button', { name: 'Keep reference', exact: true }).click();
  await deletion.waitFor({ state: 'hidden' }); await note.waitFor();
  await note.hover(); await note.getByRole('button', { name: 'Delete UI management test note', exact: true }).click();
  await app.getByRole('dialog').getByRole('button', { name: 'Delete reference', exact: true }).click();
  await note.waitFor({ state: 'hidden' });
  const widths = [];
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(100);
    const geometry = await app.locator('article').evaluateAll(els => els.slice(0, 2).map(el => el.getBoundingClientRect().toJSON()));
    // Hover lifts a card 2 px, so compare columns by x rather than row y.
    const columns = Math.abs(geometry[0].left - geometry[1].left) > 40 ? 2 : 1;
    if (columns !== (width >= 600 ? 2 : 1)) throw Error('Incorrect columns at ' + width);
    const overflow = await app.locator('main').evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw Error('Horizontal overflow at ' + width);
    widths.push({ width, columns, overflow });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.mouse.move(1, 1); await page.waitForTimeout(300);
  await page.screenshot({ path: 'output/playwright/mcp-management-768.png' });
  return { favoriteAndHover: true, importNote: true, tagsAndFiltering: true, tagRenameAndRemoval: true, confirmedDeleteAndCancel: true, widths };
}
