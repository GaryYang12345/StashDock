async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 439, height: 1000 });
  await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const app = page.frameLocator('iframe');
  await app.getByRole('searchbox', { name: 'Search references' }).fill('Settings fixture');
  await app.getByRole('article', { name: 'Settings fixture', exact: true }).waitFor();
  const reference = app.getByRole('article', { name: 'Settings fixture', exact: true });
  await reference.getByRole('button', { name: 'Select Settings fixture', exact: true }).click({ force: true });
  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  await app.getByRole('heading', { name: 'General', exact: true }).waitFor();
  if (await app.getByText('Launch at login', { exact: true }).count() || await app.getByText('Shortcut', { exact: true }).count()) throw Error('Desktop-only controls leaked into the plugin');
  await app.getByRole('button', { name: 'Change location', exact: true }).waitFor();
  await app.getByRole('button', { name: 'Open folder', exact: true }).waitFor();
  await app.getByRole('button', { name: 'About storage location', exact: true }).hover();
  await app.getByText('Shared by StashDock Desktop and AI plugins on this device.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  let reject = true;
  await page.route('**/tool', async route => {
    const request = route.request().postDataJSON();
    if (reject && request.name === 'save_stashdock_preferences') {
      reject = false; await route.fulfill({ json: { isError: true, content: [{ type: 'text', text: 'Simulated write failure. Retry.' }] } }); return;
    }
    await route.continue();
  });
  await app.getByRole('radio', { name: 'Dark', exact: true }).click();
  await app.getByText('Error: Simulated write failure. Retry.', { exact: true }).waitFor();
  if (!await app.getByRole('radio', { name: 'Follow ChatGPT', exact: true }).isChecked()) throw Error('Failed save changed the selected theme');
  await app.getByRole('radio', { name: 'Dark', exact: true }).click();
  const html = app.locator('html');
  await page.waitForFunction(() => document.querySelector('iframe').contentDocument.documentElement.dataset.theme === 'dark');
  await app.getByRole('button', { name: 'Language: Follow system', exact: true }).click();
  await app.getByRole('menuitem', { name: '简体中文', exact: true }).click();
  await app.getByRole('heading', { name: '通用', exact: true }).waitFor();
  await app.getByRole('radio', { name: '浅色', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('iframe').contentDocument.documentElement.dataset.theme === 'light');
  await page.evaluate(() => document.querySelector('iframe').contentWindow.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } }, location.origin));
  await app.getByRole('radio', { name: '浅色', exact: true }).waitFor();
  if (await html.getAttribute('data-theme') !== 'light') throw Error('Host theme overwrote user choice');
  await app.getByRole('radio', { name: '跟随 ChatGPT', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('iframe').contentDocument.documentElement.dataset.theme === 'dark');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (await app.locator('[data-settings-view]').evaluate(el => el.scrollWidth > el.clientWidth)) throw Error('Settings overflow: ' + width);
    await page.screenshot({ path: `output/playwright/mcp-settings-${width}.png` });
  }
  await app.getByRole('button', { name: '返回收藏库', exact: true }).click();
  if (await app.getByRole('searchbox', { name: '搜索收藏' }).inputValue() !== 'Settings fixture') throw Error('Settings reset search');
  await app.getByRole('paragraph').filter({ hasText: /^已选 1 项$/ }).waitFor();
  await reference.waitFor();
  await page.reload();
  await app.getByRole('button', { name: '设置', exact: true }).waitFor();
  await app.getByRole('button', { name: '设置', exact: true }).click();
  await app.getByRole('button', { name: '语言: 简体中文', exact: true }).waitFor();
  if (!await app.getByRole('radio', { name: '跟随 ChatGPT', exact: true }).isChecked()) throw Error('Theme preference was not persisted');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('MCP settings: real tool persistence, errors/retry, host theme override, five widths, localized shelf and preserved search/selection passed. Isolated library; no real composer.');
}
