// Shared editor fixture plus actual packaged MCP App. Mutations use disposable libraries only.
async page => {
  const errors = [], reports = [];
  const onlyMcp = page.url().includes(':18753');
  page.on('pageerror', error => errors.push(error.message));
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
    const context = canvas.getContext('2d'); context.fillStyle = '#70857a'; context.fillRect(0, 0, 640, 400);
    context.fillStyle = '#f0e6cd'; context.beginPath(); context.arc(440, 130, 70, 0, Math.PI * 2); context.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  if (!onlyMcp) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 769 });
    await page.goto('http://127.0.0.1:18532/tests/fixtures/desktop-import.html');
    await page.locator('html').evaluate((node, theme) => { node.dataset.theme = theme; node.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    await page.getByRole('button', { name: 'Open editor fixture', exact: true }).click();
    const pick = async () => { await page.getByLabel('Choose cover image', { exact: true }).setInputFiles({ name: 'A long descriptive cover filename.png', mimeType: 'image/png', buffer: png }); await page.getByRole('img', { name: 'Selected cover' }).waitFor(); await page.waitForTimeout(300); };
    await pick();
    if (await page.locator('#saved-items').textContent() !== '[]') throw Error('Picker saved prematurely');
    await page.getByRole('button', { name: 'Close editor', exact: true }).click();
    await page.waitForTimeout(350); await page.getByRole('button', { name: 'Open editor fixture', exact: true }).click();
    if (await page.getByRole('img', { name: 'Selected cover' }).count()) throw Error('Cancelled image persisted');
    await pick(); await page.getByLabel('Title', { exact: true }).fill('Updated title');
    await page.screenshot({ path: `output/playwright/edit-cover-${theme}-${width}.png` });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Editor overflow');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit card' }).waitFor({ state: 'hidden' });
    const saved = JSON.parse(await page.locator('#saved-items').textContent())[0];
    if (saved.title !== 'Updated title' || saved.origin.previewSource !== 'custom') throw Error('Edit did not save cover');
    await page.getByRole('button', { name: 'Open editor fixture', exact: true }).click();
    await page.getByRole('img', { name: 'Selected cover' }).waitFor();
    await page.getByRole('button', { name: 'Restore default cover', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit card' }).waitFor({ state: 'hidden' });
    const restored = JSON.parse(await page.locator('#saved-items').textContent())[0];
    if (restored.preview || restored.origin.previewSource) throw Error('Default did not restore');
    reports.push({ theme, width, cancelSaveRestore: true });
  }
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(`http://127.0.0.1:18753/?theme=${theme}`);
    const frame = page.frameLocator('iframe');
    await frame.getByRole('button', { name: 'Import references', exact: true }).click();
    await frame.getByRole('tab', { name: 'Note', exact: true }).click();
    await frame.getByLabel('Content', { exact: true }).fill(`MCP cover ${theme}`);
    await frame.getByLabel('Choose cover image', { exact: true }).setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
    await frame.getByRole('img', { name: 'Selected cover' }).waitFor(); await page.waitForTimeout(350);
    await frame.getByRole('button', { name: 'Save note', exact: true }).click();
    await frame.getByRole('dialog', { name: 'Import references', exact: true }).waitFor({ state: 'hidden' });
    const card = frame.locator('[data-reference-id]').filter({ hasText: `MCP cover ${theme}` }).first();
    await card.getByRole('button', { name: `Edit MCP cover ${theme}`, exact: true }).click();
    await frame.getByRole('menuitem', { name: 'Edit card', exact: true }).click();
    await frame.getByRole('img', { name: 'Selected cover' }).waitFor();
    await page.waitForTimeout(600);
    const statusSize = await frame.locator('.sr-only').filter({ hasText: 'Custom cover selected' }).boundingBox();
    if (statusSize && (statusSize.width > 1 || statusSize.height > 1)) throw Error('Screen reader announcement occupies visual layout');
    await page.screenshot({ path: `output/playwright/mcp-edit-cover-${theme}.png` });
    await frame.getByRole('button', { name: 'Restore default cover', exact: true }).click();
    await frame.getByRole('button', { name: 'Save changes', exact: true }).click();
    await frame.getByRole('dialog', { name: 'Edit card' }).waitFor({ state: 'hidden' });
    reports.push({ mcp: theme, importAndEdit: true });
  }
  if (errors.length) throw Error(errors.join('\n'));
  return reports;
}
