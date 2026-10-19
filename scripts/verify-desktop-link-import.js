// Isolated fixture: no browser profiles or real collection writes.
async page => {
  await page.route('https://example.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="green"/></svg>' }));
  await page.goto('http://127.0.0.1:5173/tests/fixtures/desktop-import.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const open = async () => { await page.getByRole('button', { name: 'Open import fixture', exact: true }).click(); await page.getByRole('dialog').waitFor(); };
  const settle = () => page.waitForTimeout(550);
  const sizes = [];
  await open();
  if (await page.getByRole('tab').count() !== 3) throw Error('Reference types changed');
  const checkTabLayout = async () => {
    const valid = await page.getByRole('tab').evaluateAll(tabs => tabs.every(tab => {
      const icon = tab.querySelector('svg'), label = tab.querySelector('span:last-child');
      const outer = tab.getBoundingClientRect(), glyph = icon.getBoundingClientRect(), text = label.getBoundingClientRect();
      return glyph.left >= outer.left && glyph.right <= outer.right && glyph.top >= outer.top && glyph.bottom <= outer.bottom && Math.abs(glyph.top + glyph.height / 2 - (text.top + text.height / 2)) < 2;
    }));
    if (!valid) throw Error('Tab icons overflow or stack above the label');
  };
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await settle();
    const result = await page.getByRole('dialog').evaluate(el => ({ noOverflow: el.scrollWidth <= el.clientWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
    if (!result.noOverflow || result.left < 0 || result.right > width) throw Error(JSON.stringify({ width, result }));
    sizes.push({ width, ...result });
    await checkTabLayout();
  }
  await page.getByRole('dialog').screenshot({ path: 'output/playwright/import-link-empty.png' });
  await page.getByRole('button', { name: 'Import from', exact: true }).click();
  await page.getByRole('menu').ariaSnapshot();
  await page.getByRole('menu').screenshot({ path: 'output/playwright/import-platform-menu.png' });
  if (await page.getByRole('menuitem').count() !== 3) throw Error('Browser profiles should be grouped by app');
  await page.getByRole('menuitem', { name: 'Chrome', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Reference 1', exact: true }).waitFor();
  await settle();
  if (await page.getByRole('checkbox', { name: 'Select Already saved', exact: true }).isEnabled()) throw Error('Saved link selectable');
  if (await page.getByRole('checkbox').count() > 102) throw Error('Entire large list rendered');
  if (await page.getByRole('textbox', { name: 'Search bookmarks', exact: true }).count() || await page.getByRole('textbox', { name: 'Tags', exact: true }).count() || await page.getByRole('button', { name: 'Add tags', exact: true }).count()) throw Error('Batch search or tags still present');
  await page.getByRole('dialog').locator('li').first().locator('img[data-loaded]').waitFor();
  await page.getByRole('button', { name: 'Show 100 more', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Other profile', exact: true }).waitFor();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 684 }); await settle();
    const noOverflow = await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth);
    if (!noOverflow) throw Error('Bookmark preview overflow at ' + width);
  }
  await page.getByRole('checkbox', { name: 'Select all', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Select Reference 1', exact: true }).check();
  await page.getByRole('dialog').screenshot({ path: 'output/playwright/import-browser-selection.png' });
  await page.getByRole('button', { name: 'Import 1 link', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const imported = JSON.parse(await page.locator('#saved-items').innerText());
  if (imported.length !== 1 || imported[0].title !== 'Reference 1' || imported[0].tags.length !== 0 || imported[0].origin.importMethod !== 'browser_bookmarks') throw Error('Incorrect selected import');
  await open();
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/page');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Custom title');
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Custom\n\ncontext');
  await page.waitForTimeout(1500);
  if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Custom title') throw Error('Lookup overwrote title');
  if (await page.getByRole('textbox', { name: 'Content', exact: true }).inputValue() !== 'Custom\n\ncontext') throw Error('Lookup overwrote content');
  await page.getByRole('tab', { name: 'Note', exact: true }).click();
  await settle();
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Draft note');
  await page.getByRole('tab', { name: 'Link', exact: true }).click();
  await settle();
  if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Custom title') throw Error('Switching modes erased draft');
  const input = page.getByRole('textbox', { name: 'Tags', exact: true });
  await input.fill('Design, systems'); await input.press('Enter');
  await page.getByRole('button', { name: 'Remove Design, systems', exact: true }).waitFor();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 684 }); await settle();
    if (!await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)) throw Error('Manual form overflow at ' + width);
  }
  await page.getByRole('dialog').screenshot({ path: 'output/playwright/import-link-details.png' });
  await page.getByRole('button', { name: 'Save link', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const manual = JSON.parse(await page.locator('#saved-items').innerText())[0];
  if (manual.title !== 'Custom title' || manual.content !== 'Custom\n\ncontext' || manual.tags[0] !== 'Design, systems') throw Error('Manual payload mismatch');
  await open();
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/slow');
  await page.waitForTimeout(800);
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/new');
  await page.waitForTimeout(2600);
  if (await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue() !== 'Detected new') throw Error('Stale lookup replaced latest URL');
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/fail');
  await page.getByRole('button', { name: 'Retry lookup', exact: true }).waitFor();
  if (!await page.getByRole('button', { name: 'Save link', exact: true }).isEnabled()) throw Error('Lookup failure blocked manual import');
  await page.getByRole('button', { name: 'Import from', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edge', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Close Edge' }).waitFor();
  if (!await page.getByRole('button', { name: 'Refresh bookmarks', exact: true }).isEnabled()) throw Error('Browser failure cannot retry');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await open();
  await page.getByRole('tab', { name: 'File', exact: true }).click(); await settle();
  if (await page.getByText('Original files stay unchanged.', { exact: true }).count()) throw Error('Redundant file copy remains');
  await page.getByRole('button', { name: 'Choose tags', exact: true }).click();
  await page.getByRole('button', { name: 'Add tag UI', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Tags', exact: true }).fill('File draft');
  await page.getByRole('button', { name: 'Choose files', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const file = JSON.parse(await page.locator('#saved-items').innerText())[0];
  if (file.kind !== 'file' || file.tags.join('|') !== 'UI|File draft') throw Error('File tags were not sent to native import');
  await page.getByRole('checkbox', { name: 'Simulate save failure', exact: true }).check();
  await open(); await page.getByRole('tab', { name: 'Note', exact: true }).click(); await settle();
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Note body');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Test save failed' }).waitFor();
  if (!await page.getByRole('dialog').isVisible() || await page.getByRole('textbox', { name: 'Content', exact: true }).inputValue() !== 'Note body') throw Error('Failed save erased draft');
  await page.locator('html').evaluate(el => { el.dataset.theme = 'dark'; el.dataset.accent = 'blue'; });
  await settle(); await page.getByRole('dialog').screenshot({ path: 'output/playwright/import-dark-error.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Link', exact: true }).click(); await settle();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open import fixture' }).waitFor({ state: 'visible' });
  return { sizes, tabIconsInline: true, browserProfilesGrouped: true, noBatchTagsOrSearch: true, sharedFaviconsLoaded: true, fileTags: true, selectedImport: true, duplicateDisabled: true, autoTitle: true, staleLookupIgnored: true, userEditsPreserved: true, tagEnterOnly: true, modeDraftPreserved: true, errorsRecoverable: true, successCloses: true, darkBlue: true, reducedMotion: true };
}
