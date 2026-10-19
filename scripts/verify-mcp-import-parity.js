// Test host + isolated database only. Does not operate the real Codex composer.
async page => {
  const ui = page.frameLocator('iframe');
  const open = async () => { await ui.getByRole('button', { name: 'Import references', exact: true }).click(); await ui.getByRole('dialog').waitFor(); };
  const close = async () => { await ui.getByRole('button', { name: 'Close dialog', exact: true }).click(); await ui.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForTimeout(300); };
  await open();
  if (await ui.getByRole('tab').count() !== 3) throw Error('Import types not shared');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const valid = await ui.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth);
    if (!valid) throw Error('Import overflow at ' + width);
  }
  await ui.getByRole('button', { name: 'Import from', exact: true }).click();
  if (await ui.getByRole('menuitem').count() !== 2) throw Error('Browser profiles not grouped');
  const logos = await ui.getByRole('menu').locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && image.src.startsWith('data:')));
  if (!logos) throw Error('MCP browser logos not self-contained');
  await ui.getByRole('menu').screenshot({ path: 'output/playwright/mcp-import-platforms.png' });
  await ui.getByRole('menuitem', { name: 'Chrome', exact: true }).click();
  await ui.getByRole('checkbox', { name: 'Select New browser link', exact: true }).waitFor();
  if (await ui.getByRole('checkbox', { name: 'Select Already saved', exact: true }).isEnabled()) throw Error('Duplicate selectable');
  if (await ui.getByRole('textbox', { name: 'Tags', exact: true }).count() || await ui.getByRole('textbox', { name: 'Search bookmarks' }).count()) throw Error('Redundant batch inputs');
  await ui.getByRole('checkbox', { name: 'Select all', exact: true }).uncheck();
  await ui.getByRole('checkbox', { name: 'Select New browser link', exact: true }).check();
  await ui.getByRole('button', { name: 'Import 1 link', exact: true }).click();
  await ui.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForTimeout(400);
  await open();
  await ui.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/manual-import');
  await ui.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
  await page.waitForTimeout(1300);
  if (await ui.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Detected import title') throw Error('Title lookup missing');
  if (!((await ui.getByRole('textbox', { name: 'Content', exact: true }).inputValue()).includes('Second paragraph'))) throw Error('Actual content missing');
  await ui.getByRole('button', { name: 'Choose tags', exact: true }).click();
  const labelPosition = await ui.getByRole('dialog', { name: 'Import references', exact: true }).getByText('Tags', { exact: true }).boundingBox();
  const chooserPosition = await ui.getByRole('button', { name: 'Choose tags', exact: true }).boundingBox();
  if (Math.abs(labelPosition.y + labelPosition.height / 2 - chooserPosition.y - chooserPosition.height / 2) > 4) throw Error('Choose tags does not share the Tags label row');
  await ui.getByRole('button', { name: 'Add tag Fixture', exact: true }).click();
  if (!await ui.getByRole('button', { name: 'Add tag Fixture', exact: true }).count()) throw Error('Existing suggestion disappeared');
  await page.keyboard.press('Escape');
  await ui.getByRole('dialog', { name: 'Choose existing tags', exact: true }).waitFor({ state: 'detached' });
  await ui.getByRole('dialog').screenshot({ path: 'output/playwright/mcp-import-link-details.png' });
  await ui.getByRole('button', { name: 'Save link', exact: true }).click(); await ui.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForTimeout(400);
  await open(); await ui.getByRole('tab', { name: 'File', exact: true }).click(); await page.waitForTimeout(300);
  await ui.locator('input[type=file]').setInputFiles({ name: 'Fixture context.txt', mimeType: 'text/plain', buffer: Buffer.from('File content for AI') });
  await ui.getByRole('textbox', { name: 'Title', exact: true }).waitFor();
  await ui.getByRole('textbox', { name: 'Title', exact: true }).fill('Edited file title');
  await ui.getByRole('textbox', { name: 'Content', exact: true }).fill('Edited file content for AI');
  await ui.getByRole('button', { name: 'Choose tags', exact: true }).click();
  await ui.getByRole('button', { name: 'Add tag Fixture', exact: true }).click();
  await page.keyboard.press('Escape');
  await ui.getByRole('dialog', { name: 'Choose existing tags', exact: true }).waitFor({ state: 'detached' });
  await ui.getByRole('button', { name: 'Save file', exact: true }).click();
  await ui.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForTimeout(400);
  await open(); await ui.getByRole('tab', { name: 'Note', exact: true }).click(); await page.waitForTimeout(300);
  await ui.getByRole('textbox', { name: 'Content', exact: true }).fill('Note content for AI');
  await ui.getByRole('button', { name: 'Save note', exact: true }).click(); await ui.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForTimeout(400);
  for (const theme of ['light', 'dark']) for (const accent of ['neutral', 'blue']) for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await ui.locator('html').evaluate((el, values) => { el.dataset.theme = values.theme; el.dataset.accent = values.accent; }, { theme, accent });
    await open(); await page.waitForTimeout(300);
    if (!await ui.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)) throw Error('Theme import overflow');
    await close();
    await ui.getByRole('button', { name: 'List', exact: true }).click(); await page.waitForTimeout(200);
    if (!await ui.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)) throw Error('List overflow');
    await ui.getByRole('button', { name: 'Grid', exact: true }).click();
    const columns = await ui.locator('article').first().evaluate(el => getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length);
    if (columns !== (width < 380 ? 1 : width < 720 ? 2 : 3)) throw Error('Incorrect responsive card columns at ' + width);
  }
  if (await page.locator('#draft').inputValue() !== 'Keep this draft unchanged.' || await page.locator('#attachments').locator('.chip').count()) throw Error('Import changed the draft');
  await page.setViewportSize({ width: 439, height: 1000 });
  await ui.locator('html').evaluate(el => { el.dataset.theme = 'light'; el.dataset.accent = 'neutral'; });
  await page.screenshot({ path: 'output/playwright/mcp-import-sidebar-0413.png' });
  return { sharedImport: true, browserPicker: true, inlineLogos: true, manualLookup: true, filesAndNotes: true, themesAndWidths: 20, draftUntouched: true };
}
