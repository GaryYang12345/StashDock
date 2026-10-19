// Isolated IPC/SDK launch checks. OS file association is verified separately.
async page => {
  const reports = [], errors = [];
  const only = new URL(page.url()).searchParams.get('test-host');
  page.on('pageerror', error => errors.push(error.message));
  if (only !== 'mcp') for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
    await page.locator('html').evaluate((node, value) => { node.dataset.theme = value; }, theme);
    for (const view of ['Grid', 'List']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.getByRole('button', { name: 'Open A saved reference', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.openedReference === '1');
      if (await page.getByRole('dialog').count()) throw Error('Note unexpectedly opened an in-app dialog');
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Page overflows');
    await page.screenshot({ path: `output/playwright/note-txt-desktop-${theme}-${width}.png` });
    reports.push({ host: 'desktop', theme, width, gridAndList: true, fileCommand: true });
  }
  if (only === 'desktop') { if (errors.length) throw Error(errors.join('\n')); return reports; }
  const title = 'Note opens as txt';
  const imported = await page.request.post('http://127.0.0.1:18754/tool', { data: { name: 'import_stashdock_references', arguments: { items: [{ title, kind: 'note', source: 'Note', excerpt: '', content: 'Unchanged note text', tags: [], createdAt: '2026-10-17T00:00:00Z' }] } } });
  const result = await imported.json();
  if (!imported.ok() || result.isError) throw Error(JSON.stringify(result));
  const calls = [];
  await page.route('**/tool', async route => {
    const input = route.request().postDataJSON();
    if (input.name !== 'open_stashdock_file') { await route.continue(); return; }
    calls.push(input);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '{"opened":true}' }], structuredContent: { opened: true } }) });
  });
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`http://127.0.0.1:18754/?theme=${theme}`);
    const frame = page.frameLocator('iframe');
    await frame.getByRole('button', { name: `Open ${title}`, exact: true }).click();
    await page.waitForTimeout(250);
    if (await frame.getByRole('dialog').count()) throw Error('MCP Note unexpectedly opened an in-app dialog');
    await page.screenshot({ path: `output/playwright/note-txt-mcp-${theme}.png` });
    reports.push({ host: 'mcp', theme, fileCommand: true });
  }
  if (calls.length !== 2 || calls.some(call => Object.keys(call.arguments).join() !== 'id' || typeof call.arguments.id !== 'string')) throw Error('MCP must open the selected saved ID, never a UI path');
  if (errors.length) throw Error(errors.join('\n'));
  return { reports, errors, launchSimulated: true };
}
