// Run against the local website through playwright-cli run-code --filename.
// The sample library is isolated; no desktop/extension write APIs are called.
async page => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4310/', { waitUntil: 'domcontentloaded' });
  await page.locator('#import .import').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1400);
  if (await page.locator('#import .script-cursor').count()) throw Error('Reduced motion still autoplays');
  const language = await page.locator('html').getAttribute('lang');
  if (language !== 'zh-CN') await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click();
  const demo = page.locator('#how');
  await demo.locator('.demo-desk').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  if (await demo.getByRole('article').count() !== 27) throw Error('Expected 27 curated demo references');
  const sources = await demo.getByRole('article').locator('img').evaluateAll(nodes => [...new Set(nodes.map(node => node.src).filter(src => src.includes('/assets/covers/')))]);
  if (sources.length !== 22) throw Error(`Expected 22 image covers, got ${sources.length}`);
  await page.evaluate(async sources => {
    await Promise.all(sources.map(src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = () => reject(Error(src)); image.src = src;
    })));
  }, sources);
  const search = demo.getByRole('searchbox', { name: '搜索收藏', exact: true });
  await search.fill('card-ui-design');
  const card = demo.getByRole('article', { name: 'card-ui-design', exact: true });
  await card.hover();
  // Use a real pointer click after revealing the card's hover action. This
  // avoids locator auto-scrolling the long page beneath its sticky header.
  const add = card.getByRole('button', { name: '将“card-ui-design”添加到对话', exact: true });
  const box = await add.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => document.querySelector('#how .composer-chips'));
  const input = demo.locator('.composer-input');
  if (await input.getAttribute('placeholder') !== '') throw Error('Suggested question remains');
  if (await input.inputValue() !== '') throw Error('Question was injected');
  if (!await demo.getByRole('button', { name: '发送', exact: true }).isDisabled()) throw Error('Empty draft sends invented question');
  await demo.locator('.demo-desk').screenshot({ path: 'output/playwright/website-real-cards-zh.png' });
  await demo.getByRole('button', { name: '移除 card-ui-design', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#how .composer-chips'));
  if (await input.getAttribute('placeholder') !== '有问题，尽管问') throw Error('Normal placeholder did not return');
  await search.fill('seeco');
  if (await demo.getByRole('article').count() !== 1) throw Error('X reference search failed');
  await search.fill('');
  const responsiveWidths = [320, 390, 560, 768, 960, 1024, 1440];
  for (const width of responsiveWidths) {
    await page.setViewportSize({ width, height: 1000 });
    await demo.locator('.demo-plugin').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error(`Horizontal overflow at ${width}`);
    const chatBox = await demo.locator('.demo-chat').boundingBox();
    const pluginBox = await demo.locator('.demo-plugin').boundingBox();
    if (Math.abs(chatBox.y - pluginBox.y) > 1 || Math.abs(chatBox.height - pluginBox.height) > 1 || chatBox.x + chatBox.width > pluginBox.x + 1) throw Error(`Demo is not side by side at ${width}`);
    if (width <= 560 && chatBox.width / (chatBox.width + pluginBox.width) < 0.43) throw Error(`Phone chat is too narrow at ${width}`);
    if (width > 560 && width <= 960 && chatBox.width < pluginBox.width) throw Error(`Chat should have at least equal space on portrait tablets at ${width}`);
    const importBox = await demo.getByRole('button', { name: '导入收藏', exact: true }).boundingBox();
    if (importBox.x < pluginBox.x || importBox.x + importBox.width > pluginBox.x + pluginBox.width + 1) throw Error(`Import action is clipped at ${width}`);
    const filterBoxes = await demo.locator('.demo-filters').evaluate(node => Array.from(node.children).map(child => { const r = child.getBoundingClientRect(); return r.y + r.height / 2; }));
    if (Math.max(...filterBoxes) - Math.min(...filterBoxes) > 1) throw Error(`Collection, tags and refresh must stay in one row at ${width}`);
    const columns = await demo.locator('.demo-card-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    if (columns !== (width <= 960 ? 1 : 2)) throw Error(`Incorrect card column count at ${width}: ${columns}`);
    await demo.locator('.demo-desk').screenshot({ path: `output/playwright/website-side-by-side-${width}.png` });
    await demo.locator('.demo-plugin').screenshot({ path: `output/playwright/website-selected-cards-${width}.png` });
    if (width <= 390) {
      await search.fill('card-ui-design');
      const narrowCard = demo.getByRole('article', { name: 'card-ui-design', exact: true });
      await narrowCard.hover();
      await narrowCard.getByRole('button', { name: '将“card-ui-design”添加到对话', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#how .composer-chips'));
      const remove = demo.getByRole('button', { name: '移除 card-ui-design', exact: true });
      const removeBox = await remove.boundingBox();
      if (removeBox.x < chatBox.x || removeBox.x + removeBox.width > chatBox.x + chatBox.width + 1) throw Error(`Attachment action escapes chat at ${width}`);
      await demo.locator('.demo-desk').screenshot({ path: `output/playwright/website-side-by-side-attached-${width}.png` });
      await remove.click();
      await page.waitForFunction(() => !document.querySelector('#how .composer-chips'));
      await search.fill('');
    }
  }
  await page.setViewportSize({ width: 1024, height: 1366 });
  await demo.locator('.demo-desk').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const portraitColumns = await demo.locator('.demo-card-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  if (portraitColumns !== 1) throw Error('Tall tablet must have one card per row');
  await demo.locator('.demo-desk').screenshot({ path: 'output/playwright/website-portrait-tablet-1024.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '切换到英文', exact: true }).click();
  if (await demo.getByRole('article').count() !== 27) throw Error('Language switch lost references');
  await demo.getByRole('button', { name: 'Tags', exact: true }).click();
  // Radix labels the open menu from its trigger, which becomes the active tag.
  const tagMenu = page.locator('[role="menu"][aria-label="Tags"]');
  const tagOptions = await tagMenu.getByRole('menuitemradio').allTextContents();
  const expectedTags = ['AI', 'Design', 'Travel', 'Work', 'Writing'];
  if (tagOptions.length !== 6) throw Error('Expected All tags and five categories');
  for (const name of expectedTags) if (!tagOptions.some(text => text.startsWith(name))) throw Error(`Missing tag ${name}`);
  await tagMenu.screenshot({ path: 'output/playwright/website-curated-tags.png' });
  await tagMenu.getByRole('menuitemradio', { name: 'Filter by Travel', exact: true }).click();
  await tagMenu.waitFor({ state: 'hidden' });
  if (await demo.getByRole('article').count() !== 2) throw Error('Travel filter has incorrect cards');
  // Reopen by keyboard after the menu's focus-return handoff has completed.
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-haspopup') === 'menu');
  await demo.getByRole('button', { name: 'Travel', exact: true }).press('ArrowDown');
  await tagMenu.waitFor({ state: 'visible' });
  await page.getByRole('menuitemradio', { name: 'All tags', exact: true }).click();
  if (await demo.getByRole('article').count() !== 27) throw Error('Clearing tag did not restore all cards');
  const platformBody = await page.locator('.platforms .lede').innerText();
  if (!platformBody.includes('beside your AI chat') || platformBody.includes('ChatGPT')) throw Error('Platform copy is host-specific');
  const pluginCard = page.locator('#download .download-card').nth(1);
  const pluginText = await pluginCard.innerText();
  if (!pluginText.includes('For ChatGPT') || !pluginText.includes('More AI plugins coming soon.') || pluginText.includes('Codex')) throw Error('Incorrect plugin availability');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await pluginCard.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error(`Download overflow at ${width}`);
    await page.locator('#download .download-grid').screenshot({ path: `output/playwright/website-plugin-download-${width}.png` });
  }
  await demo.locator('.demo-plugin').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await demo.getByRole('button', { name: 'List', exact: true }).click();
  if (await demo.getByRole('article', { name: 'Anti-Defensive Writing', exact: true }).count() !== 1) throw Error('Note disappeared in list');
  await demo.getByRole('button', { name: 'Grid', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click();
  await demo.locator('.demo-desk').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  return { references: 27, decodedCovers: sources.length, tags: expectedTags, tagFilter: true, pluginAvailability: true, widths: responsiveWidths, sideBySide: true, narrowChatAttachments: true, chineseNoSuggestion: true, removeRestoresPlaceholder: true, languageSwitch: true, gridAndList: true };
}
