// Playwright CLI run-code. Uses only the isolated folder search fixture and mocks.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 480, height: 300 });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/folder-search.html');
  const field = page.getByRole('searchbox', { name: 'Search references' });
  await field.waitFor();
  if (await page.locator('article').count()) throw Error('Cards shown before a search');
  await field.click();
  await page.keyboard.type('re');
  await page.locator('article[data-current]').first().waitFor();
  const regions = await page.evaluate(() => window.__calls.filter(([name]) => name === 'folder_search_region').map(([, args]) => args.rects.length));
  if (regions.at(-1) !== 2) throw Error('The visible cards were not added to the window region: ' + regions);
  await page.screenshot({ path: 'output/playwright/folder-search-results.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.documentElement.dataset.copied)) throw Error('Enter copied; only Copy copies');
  const current = page.locator('article[data-current]').first();
  await current.hover();
  await current.getByRole('button', { name: /^Copy .* for AI$/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.copied);
  await page.locator('article[data-copied]').waitFor();
  // The field's region is centred on it, with room for its shadow.
  const box = await page.getByRole('searchbox').evaluate(node => node.closest('[class*="field"]').getBoundingClientRect().toJSON());
  const rect = await page.evaluate(() => window.__calls.filter(([name]) => name === 'folder_search_region').at(-1)[1].rects[0]);
  if (Math.abs((rect.x + rect.width / 2) - (box.left + box.width / 2)) > 1) throw Error('The field region is not centred on the field');
  await field.fill('');
  await page.waitForFunction(() => !document.querySelector('article'));
  const cleared = await page.evaluate(() => window.__calls.filter(([name]) => name === 'folder_search_region').at(-1)[1].rects.length);
  if (cleared !== 1) throw Error('The cleared search kept the cards region');
  await field.fill('zzz');
  await page.getByText('No matching references', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__calls.some(([name]) => name === 'folder_search_close'));
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Folder search: field first, one result swap, centred regions that follow the cards, Up/Down turning, Copy-only copying, empty state and Escape passed. All IPC was mocked.');
}
