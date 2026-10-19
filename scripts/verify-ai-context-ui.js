// Actual SDK bridge + generated MCP UI. The server requires an isolated
// mcp-test directory and explicit preview mutations; no real collection writes.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const app = page.frameLocator('iframe');
  await app.getByRole('button', { name: 'Refresh library', exact: true }).waitFor();
  const call = async (name, args) => page.evaluate(async ({ name, args }) => {
    const response = await fetch('/tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }) });
    const result = await response.json();
    if (!response.ok || result.isError) throw Error(JSON.stringify(result));
    return result;
  }, { name, args });
  const payload = { title: 'AI context UI acceptance', content: 'Check keyboard navigation. Keep reusable findings with their sources.', tags: ['Design'], contentOrigin: 'generated', sourceUrls: ['https://example.org/guide'] };
  const saved = await call('save_stashdock_reference', payload);
  if (!saved.structuredContent.item.id) throw Error('Save returned no reference ID');
  const tags = await call('list_stashdock_tags', {});
  if (!tags.structuredContent.tags.some(tag => tag.name === 'Design')) throw Error('Saved tag is not discoverable');
  const found = await call('search_stashdock', { tag: 'design' });
  if (!found.structuredContent.items.some(item => item.id === saved.structuredContent.item.id)) throw Error('Tag group does not include saved context');
  const read = await call('get_stashdock_items', { ids: [saved.structuredContent.item.id] });
  if (read.structuredContent.items[0].context !== payload.content) throw Error('Read differs from saved context');
  await app.getByRole('button', { name: 'Refresh library', exact: true }).click();
  const card = app.getByRole('article', { name: payload.title, exact: true });
  await card.waitFor();
  await card.getByRole('button', { name: `Edit ${payload.title}`, exact: true }).click();
  await app.getByRole('menuitem', { name: 'Edit content', exact: true }).click();
  const dialog = app.getByRole('dialog', { name: 'Edit content', exact: true });
  await dialog.waitFor();
  const exported = await dialog.getByRole('textbox', { name: 'Context content', exact: true }).inputValue();
  if (!exported.includes('Content origin: AI-generated\nSources: https://example.org/guide')) throw Error('Provenance missing from visual context editor');
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await app.locator('html').evaluate((el, theme) => { el.dataset.theme = theme; el.dataset.accent = theme === 'dark' ? 'blue' : 'neutral'; }, theme);
    if (await app.locator('html').evaluate(el => el.scrollWidth > innerWidth)) throw Error('AI context editor overflow');
    if (width === 390) await page.screenshot({ path: `output/playwright/ai-context-editor-${theme}.png` });
  }
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  const before = (await call('list_stashdock_shelf', {}))._meta.items.length;
  const repeat = await call('save_stashdock_reference', payload);
  if (repeat.structuredContent.created !== false) throw Error('Retry created a duplicate');
  await app.getByRole('button', { name: 'Refresh library', exact: true }).click();
  await card.waitFor();
  const after = (await call('list_stashdock_shelf', {}))._meta.items.length;
  if (after !== before) throw Error('Retry changed the stored reference count');
  await page.waitForFunction(expected => document.querySelector('iframe').contentDocument.querySelectorAll('article').length === expected, after);
  if (await card.count() !== 1) throw Error('Duplicate appeared in shelf');
  if (errors.length) throw Error(errors.join('\n'));
  return { tagSearchReadSave: true, sameShelfVisible: true, provenanceInEditor: true, duplicateNotAdded: true, themes: 2, widths: 4, pageErrors: errors.length };
}
