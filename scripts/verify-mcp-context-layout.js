// Isolated fixture host only, never the user's actual conversation or library.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto('http://127.0.0.1:18747/');
  const app = page.frameLocator('iframe');
  const first = app.locator('article').first(); await first.waitFor();
  const title = await first.locator('h3').innerText();
  await first.hover();
  const favorite = first.getByRole('button', { name: /^(Favorite|Unfavorite) / });
  const wasFavorite = await favorite.getAttribute('aria-pressed') === 'true';
  await favorite.click(); await first.getByRole('button', { name: wasFavorite ? /^Favorite / : /^Unfavorite / }).waitFor();
  await page.mouse.move(1, 1); await page.keyboard.press('Shift'); await page.waitForTimeout(250);
  if (await first.locator('[class*="controls"]').evaluate(el => getComputedStyle(el).opacity) !== '0') throw Error('Star or Shift pins hover actions');
  const menu = first.getByRole('button', { name: /^More options for / });
  await menu.click();
  if (await app.getByRole('menuitem').count() !== 2) throw Error('Card menu must contain two edit actions');
  await app.getByRole('menuitem', { name: 'Edit card', exact: true }).click();
  const editor = app.getByRole('dialog', { name: 'Edit card', exact: true });
  await editor.getByText('Press Enter to add a tag', { exact: true }).first().waitFor();
  const field = editor.getByRole('textbox', { name: 'Tags', exact: true });
  await field.fill('MCP test, one tag'); await field.press('Enter');
  await editor.getByRole('button', { name: 'Remove MCP test, one tag', exact: true }).waitFor();
  const suggestion = editor.getByRole('group', { name: 'Existing tags' }).getByRole('button').filter({ hasText: /.+/ }).first();
  if (await suggestion.count() && !await suggestion.isDisabled()) { await suggestion.click(); if (!await suggestion.isVisible() || !await suggestion.isDisabled()) throw Error('Chosen suggestion disappeared'); }
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
  await page.waitForTimeout(350);
  if (!await menu.evaluate(el => el === document.activeElement)) throw Error('Metadata save did not restore menu focus');
  await menu.click(); await app.getByRole('menuitem', { name: 'Edit content', exact: true }).click();
  const content = app.getByRole('dialog', { name: 'Edit content', exact: true });
  const body = content.getByRole('textbox', { name: 'Context content', exact: true });
  const original = await body.inputValue();
  if (!original.startsWith('# StashDock context\n\n## ' + title) || !original.includes('URL: ') || !original.includes('### ')) throw Error('Editor omitted final context metadata/body identity');
  const revised = '# StashDock context\n\n## Curated snapshot\nSource: fixture\nURL: https://example.test/\n\n  Verbatim 中文 😀\n' + 'long context '.repeat(2000);
  await body.fill(revised);
  await content.getByRole('button', { name: 'Save changes', exact: true }).click(); await content.waitFor({ state: 'hidden' });
  await page.waitForTimeout(350);
  if (!await menu.evaluate(el => el === document.activeElement)) throw Error('Content save did not restore menu focus');
  await first.hover(); await first.getByRole('button', { name: /^Add .+ to chat$/ }).click();
  await first.getByRole('button', { name: /^Add .+ to chat$/ }).filter({ hasText: 'Added' }).waitFor();
  const sent = await page.evaluate(() => window.testRequests.at(-1).params);
  if (sent.content[0].resource.text !== revised || sent._meta['openai/message'].send !== false) throw Error('Draft payload differs from saved complete context');
  if (await page.getByRole('textbox', { name: 'Test draft', exact: true }).inputValue() !== 'Keep this draft unchanged.') throw Error('Draft text changed');
  await page.getByRole('button', { name: 'Remove test attachment' }).click();
  await menu.click(); await app.getByRole('menuitem', { name: 'Edit content', exact: true }).click();
  if (await body.inputValue() !== revised) throw Error('Content reload lost the final snapshot');
  await body.fill('Unsaved'); await content.getByRole('button', { name: 'Cancel', exact: true }).click(); await content.waitFor({ state: 'hidden' });
  const results = [];
  for (const theme of ['light', 'dark']) {
    await app.locator('main').evaluate((_, theme) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = theme === 'light' ? 'neutral' : 'blue'; }, theme);
    for (const width of [320, 360, 379, 380, 390, 439, 600, 719, 720, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await page.mouse.move(1, 1); await page.waitForTimeout(200);
      const rects = await app.locator('article').evaluateAll(els => els.slice(0, 6).map(el => el.getBoundingClientRect().toJSON()));
      const columns = rects.filter(rect => Math.abs(rect.top - rects[0].top) < 4).length;
      if (columns !== (width >= 720 ? 3 : width >= 380 ? 2 : 1)) throw Error('Wrong column count at ' + width);
      const metrics = await app.getByRole('group', { name: 'Collection', exact: true }).evaluate(el => el.getBoundingClientRect().toJSON());
      const tags = await app.getByRole('button', { name: 'Tags', exact: true }).boundingBox();
      const frame = await page.locator('iframe').boundingBox();
      if (Math.abs(tags.y - frame.y - metrics.y) > 10) throw Error('Tags moved below the collection bar');
      const overflow = await app.locator('main').evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw Error('Horizontal overflow at ' + width);
      results.push({ width, theme, columns });
      if ([390, 768, 1440].includes(width)) await page.screenshot({ path: `output/playwright/mcp-044-${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await first.click({ button: 'right' });
  if (await app.getByRole('menuitem').count() !== 1) throw Error('Right click contains redundant actions');
  await page.keyboard.press('Escape');
  await app.getByRole('searchbox', { name: 'Search references', exact: true }).click(); await page.keyboard.press('Shift');
  const pointerRing = await app.getByRole('searchbox').evaluate(el => ({ width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
  if (pointerRing.width !== '0px' && pointerRing.style !== 'none') throw Error('Shift creates a pointer-focus outline');
  await page.keyboard.press('Tab');
  const keyboardFocus = await app.locator('main').evaluate(() => ({ modality: document.documentElement.dataset.desktopFocus, outline: getComputedStyle(document.activeElement).outlineWidth }));
  if (keyboardFocus.modality !== 'keyboard' || keyboardFocus.outline === '0px') throw Error('Keyboard navigation lost focus feedback');
  if (errors.length) throw Error(errors.join('\n'));
  return { finalPayloadExact: true, draftUnchanged: true, autoCloseAndFocus: true, tagsKeepSuggestions: true, hoverAndShift: true, results, pageErrors: errors };
}
