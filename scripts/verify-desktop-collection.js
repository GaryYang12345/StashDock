// Only the isolated browser fixture. No native library or Codex draft writes.
async page => {
  await page.goto('http://127.0.0.1:18749/tests/fixtures/desktop-collection.html');
  await page.getByRole('article').first().waitFor();
  if (await page.getByRole('button', { name: 'Select all', exact: true }).count()) throw Error('Select all should wait for a selection');
  await page.getByRole('article').first().hover();
  await page.getByRole('article').first().getByRole('button', { name: /^Add .* to context$/ }).click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Desktop collection overflow at ' + width);
      const fit = await page.getByRole('status', { name: 'Loading preview' }).first().evaluate(el => {
        const preview = el.parentElement.parentElement.getBoundingClientRect();
        return [...el.querySelectorAll('span span')].every(line => {
          const rect = line.getBoundingClientRect();
          return rect.top >= preview.top && rect.bottom <= preview.bottom && rect.left >= preview.left && rect.right <= preview.right;
        });
      });
      if (!fit) throw Error('Desktop document skeleton clipping at ' + width);
      const positioned = await page.getByRole('button', { name: 'Select all', exact: true }).evaluate(el => {
        const rect = el.getBoundingClientRect(), bar = el.closest('[aria-label="Selected references"]')?.getBoundingClientRect();
        const count = el.parentElement.querySelector('p')?.getBoundingClientRect();
        return bar && count && Math.abs(rect.left - count.right - 8) < 1 && Math.abs((rect.top + rect.bottom - count.top - count.bottom) / 2) < 1 && rect.left >= bar.left && rect.right <= bar.right && rect.top >= bar.top && rect.bottom <= bar.bottom;
      });
      if (!positioned) throw Error('Desktop Select all position at ' + width);
      if (width === 1440) await page.screenshot({ path: `output/playwright/document-collection-${theme}.png` });
    }
  }
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByText('6 selected', { exact: true }).waitFor();
  if (await page.getByRole('region', { name: 'Selected references' }).getByRole('button', { name: 'Select all' }).count() !== 1) throw Error('Desktop drag bar is missing Select all');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  console.log('Desktop collection placement, five-line document skeleton, selection and responsive themes passed.');
}
