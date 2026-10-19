// Isolated fixtures only. Does not write to the user's library or Codex draft.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:18749/tests/fixtures/preview-selection.html');
  await page.getByRole('status', { name: 'Loading preview' }).waitFor();
  if (await page.getByRole('status', { name: 'Loading preview' }).locator('span span').count() !== 5) throw Error('Expected five document skeleton lines');
  if (await page.getByText('Loading preview…', { exact: true }).count()) throw Error('Visible loading caption remains');
  if (await page.getByRole('region', { name: 'Selected references' }).getByRole('button', { name: 'Select all' }).count() !== 1) throw Error('Select all is missing from the drag bar');
  const pulse = await page.getByRole('status', { name: 'Loading preview' }).locator('span span').first().evaluate(el => getComputedStyle(el).animationName);
  if (pulse === 'none') throw Error('Loading state has no animation');
  await page.getByRole('button', { name: 'Fail preview' }).click();
  await page.getByText('Web page', { exact: true }).waitFor();
  if (await page.getByRole('status', { name: 'Loading preview' }).count()) throw Error('Failed preview still loading');
  await page.getByRole('button', { name: 'Complete preview' }).click();
  await page.locator('img').waitFor();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 selected' }).waitFor();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Desktop fixture overflow at ' + width);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Queue preview' }).click();
  const reduced = await page.getByRole('status', { name: 'Loading preview' }).locator('span span').first().evaluate(el => getComputedStyle(el).animationName);
  if (reduced !== 'none') throw Error('Reduced motion still pulses');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  let completed = false;
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  await page.route('**/tool', async route => {
    if (route.request().postDataJSON().name !== 'list_stashdock_shelf') return route.continue();
    const response = await route.fetch(), json = await response.json();
    if (completed) for (const row of json._meta.items) { row.preview = image; row.previewStatus = undefined; }
    await route.fulfill({ response, json });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:18747/');
  const frame = page.locator('iframe'), app = page.frameLocator('iframe');
  await app.getByRole('status', { name: 'Loading preview' }).first().waitFor();
  await frame.evaluate(el => { el.style.width = '390px'; });
  const loadingFits = await app.getByRole('status', { name: 'Loading preview' }).first().evaluate(el => {
    const lines = [...el.querySelectorAll('span span')], preview = el.parentElement.parentElement.getBoundingClientRect();
    return lines.length === 3 && lines.every(line => {
      const rect = line.getBoundingClientRect();
      return rect.top >= preview.top && rect.bottom <= preview.bottom && rect.left >= preview.left && rect.right <= preview.right;
    });
  });
  if (!loadingFits) throw Error('Document skeleton is clipped in the default two-column panel');
  if (await app.getByText('Loading preview…', { exact: true }).count()) throw Error('MCP visible loading caption remains');
  if (await app.getByRole('button', { name: 'Select all', exact: true }).count()) throw Error('Select all should wait for a selection');
  await page.screenshot({ path: 'output/playwright/preview-loading-two-column.png' });
  await frame.evaluate(el => { el.style.width = '1440px'; });
  completed = true;
  await app.getByRole('article').first().locator('img').waitFor({ timeout: 15000 });
  await app.getByRole('article').first().hover();
  await app.getByRole('article').first().getByRole('button', { name: /^Select / }).click();
  if (!await app.getByRole('button', { name: 'Select all', exact: true }).evaluate(el => Boolean(el.closest('footer')))) throw Error('MCP Select all is outside the selection bar');
  await app.getByRole('button', { name: 'Select all', exact: true }).click();
  await app.getByText('36 selected', { exact: true }).first().waitFor();
  for (const theme of ['light', 'dark']) {
    await app.getByRole('main').evaluate((_, theme) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await frame.evaluate((el, width) => { el.style.width = `${width}px`; }, width);
      const overflow = await app.getByRole('main').evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw Error('MCP selected footer overflow: ' + width);
      const adjacent = await app.getByRole('button', { name: 'Select all', exact: true }).evaluate(el => {
        const button = el.getBoundingClientRect(), count = el.parentElement.querySelector('p')?.getBoundingClientRect();
        return count && Math.abs(button.left - count.right - 8) < 1 && Math.abs((button.top + button.bottom - count.top - count.bottom) / 2) < 1;
      });
      if (!adjacent) throw Error('MCP Select all is not beside selected count at ' + width);
      await app.getByRole('button', { name: 'Load more references', exact: true }).scrollIntoViewIfNeeded();
      await app.getByRole('button', { name: 'Load more references', exact: true }).click({ trial: true, timeout: 3000 });
      await app.getByRole('article').first().scrollIntoViewIfNeeded();
      if (width === 390) await page.screenshot({ path: `output/playwright/preview-selection-${theme}.png` });
    }
  }
  await app.getByRole('button', { name: 'Add to chat', exact: true }).last().click();
  await page.locator('#attachments .chip').nth(1).waitFor();
  if (await page.locator('#attachments .chip').count() !== 2) throw Error('Expected 30+6 bounded attachment batches');
  if (await page.getByRole('textbox', { name: 'Test draft' }).inputValue() !== 'Keep this draft unchanged.') throw Error('Existing draft changed');
  await app.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await app.getByRole('article').first().hover();
  await app.getByRole('article').first().getByRole('button', { name: /^Delete / }).click();
  await app.getByRole('dialog').waitFor();
  if ((await app.getByRole('dialog').innerText()).includes('stay unchanged')) throw Error('Redundant delete copy remains');
  await app.getByRole('button', { name: 'Keep reference', exact: true }).click();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Desktop loading/fallback/reduced motion and MCP automatic preview refresh, filtered Select all, batch draft attachments and responsive footer passed.');
}
