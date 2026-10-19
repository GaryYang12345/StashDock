// Actual MCP UI with an isolated library. Between phases, the companion Node
// fixture script saves the originals independently of StashDock's metadata API.
async page => {
  const reports = [], errors = [], phase = new URL(page.url()).searchParams.get('phase') || 'create';
  page.on('pageerror', error => errors.push(error.message));
  const call = async (name, args) => {
    const response = await page.request.post('http://127.0.0.1:18755/tool', { data: { name, arguments: args } });
    const result = await response.json();
    if (!response.ok() || result.isError) throw Error(JSON.stringify(result));
    return result;
  };
  const records = phase === 'verify' ? await page.evaluate(() => JSON.parse(sessionStorage.getItem('canonical-note-fixtures') || '[]')) : [];
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: theme === 'dark' ? 390 : 768, height: 900 });
    await page.goto(`http://127.0.0.1:18755/?theme=${theme}`);
    const frame = page.frameLocator('iframe'), title = `Canonical note ${theme}`, body = '  Saved note body\n\n原文  \n';
    if (phase === 'create') {
      await frame.getByRole('button', { name: 'Import references', exact: true }).click();
      await frame.getByRole('tab', { name: 'Note', exact: true }).click();
      await frame.getByLabel('Title', { exact: true }).fill(title);
      await frame.getByLabel('Content', { exact: true }).fill(body);
      await frame.getByRole('button', { name: 'Save note', exact: true }).click();
      await frame.getByRole('dialog', { name: 'Import references', exact: true }).waitFor({ state: 'hidden' });
    }
    const card = frame.locator('article').filter({ hasText: title });
    await card.getByRole('button', { name: `Open ${title}`, exact: true }).waitFor();
    const list = await call('list_stashdock_shelf', { query: title });
    const id = list._meta.items.find(item => item.title === title)?.id;
    if (!id) throw Error('Saved card missing');
    const original = await call('get_stashdock_file', { id }), path = original.structuredContent.path;
    if (!path.includes('mcp-test-') || !path.endsWith('.txt')) throw Error('Not an isolated managed note fixture');
    const full = (await call('get_stashdock_context', { id }))._meta.item;
    const expected = phase === 'create' ? body : 'externallyChangedUniquePhrase\n外部编辑已保存\n';
    if (full.content !== expected) throw Error('Original note text is stale or changed');
    await card.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
    await frame.getByRole('menuitem', { name: 'Edit content', exact: true }).click();
    const dialog = frame.getByRole('dialog', { name: 'Edit content', exact: true });
    await dialog.waitFor();
    const annotation = 'Additional card context';
    if (phase === 'create') {
      if (!(await frame.getByLabel('Context content', { exact: true }).inputValue()).includes(body)) throw Error('Saved text lost formatting');
      await frame.getByLabel('Context content', { exact: true }).fill(annotation);
      await frame.getByRole('button', { name: 'Save changes', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      const after = (await call('get_stashdock_context', { id }))._meta.item;
      if (after.content !== body || after.contextOverride !== annotation) throw Error('Annotation was not kept separate from the original');
      records.push({ theme, id, title, path });
    } else {
      const previous = records.find(row => row.theme === theme);
      if (!previous || previous.path !== path || previous.id !== id) throw Error('Original identity changed after an external save');
      if (await frame.getByLabel('Context content', { exact: true }).inputValue() !== annotation) throw Error('External editing overwrote supplemental context');
      await page.screenshot({ path: `output/playwright/canonical-note-external-save-${theme}.png` });
      await frame.getByRole('button', { name: 'Cancel', exact: true }).click();
      const search = await call('search_stashdock', { query: 'externallyChangedUniquePhrase' });
      if (!JSON.stringify(search).includes(id)) throw Error('Original text is absent from search');
      const prepared = await call('prepare_stashdock_attachment', { ids: [id] });
      if (!JSON.stringify(prepared).includes('get_stashdock_file')) throw Error('Note bypassed the normal original-file workflow');
    }
    reports.push({ theme, phase, sameOriginalFile: true, supplementalContextSeparate: true });
  }
  await page.evaluate(rows => sessionStorage.setItem('canonical-note-fixtures', JSON.stringify(rows)), records);
  if (errors.length) throw Error(errors.join('\n'));
  return reports;
}
