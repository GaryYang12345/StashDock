// Validate the English sample note and the imported source selection visually.
async page => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4310/', { waitUntil: 'domcontentloaded' });
  const importing = page.locator('#import');
  await importing.locator('.import').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1000);
  await importing.getByRole('tab', { name: '笔记', exact: true }).click();
  const content = importing.locator('textarea');
  await page.waitForFunction(() => document.querySelector('#import textarea')?.value.includes('Before sending'), null, { timeout: 15000 });
  const body = await content.inputValue();
  if (/\p{Script=Han}/u.test(body) || body.length < 600) throw Error('Expected the expanded English note');
  await importing.locator('.import-panel').screenshot({ path: 'output/playwright/website-english-note.png' });
  await importing.getByRole('tab', { name: '链接', exact: true }).click();
  await importing.getByRole('checkbox').first().waitFor({ state: 'visible', timeout: 15000 });
  const labels = await importing.getByRole('checkbox').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  if (labels.some(label => /小红书|湾区|俄勒冈|Sakana/.test(label))) throw Error('Unexpected Xiaohongshu bookmark');
  if (!labels.some(label => /Basic Pitch/.test(label)) || !labels.some(label => /Uiverse/.test(label))) throw Error('Missing new bookmark sources');
  await importing.locator('.import-panel').screenshot({ path: 'output/playwright/website-english-bookmarks.png' });
  const agents = page.locator('#agents');
  await agents.locator('.agents').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1000);
  const replay = agents.getByRole('button', { name: '重新播放', exact: true });
  if (await replay.isEnabled()) await replay.click();
  await page.waitForFunction(() => document.querySelector('#agents .agents-chat')?.textContent.includes('keep caveats specific'), null, { timeout: 10000 });
  const chat = await agents.locator('.agents-chat').innerText();
  if (/\p{Script=Han}/u.test(chat)) throw Error('Agent dialogue contains Chinese');
  const geometry = await agents.locator('.agents-chat').evaluate(node => ({ height: node.clientHeight, content: node.scrollHeight }));
  if (geometry.content > geometry.height + 1) throw Error('Agent dialogue is clipped');
  await agents.locator('.agents').screenshot({ path: 'output/playwright/website-english-agents.png' });
  return { noteCharacters: body.length, englishDialogue: true, bookmarks: labels, dialogueFits: true };
}
