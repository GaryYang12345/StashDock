// Browser regression in the isolated MCP fixture. This does not touch Codex's draft.
async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:18747/');
  const iframe = page.locator('iframe');
  const app = page.frameLocator('iframe');
  // Radix correctly aria-hides the background while its modal menu is open.
  const first = app.getByRole('article', { includeHidden: true }).first();
  await first.waitFor();
  await iframe.evaluate(el => { el.style.width = '439px'; });
  const settle = async () => first.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  const transform = () => first.evaluate(el => getComputedStyle(el).transform);
  await first.hover(); await settle();
  const raised = await transform();
  if (raised !== 'matrix(1, 0, 0, 1, 0, -2)') throw Error('Hover lift missing: ' + raised);
  await first.getByRole('button', { name: /^More options/ }).click();
  await app.getByRole('menuitem', { name: 'Edit content', exact: true }).hover(); await settle();
  if (await transform() !== raised) throw Error('Menu lost card lift');
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Test draft' }).hover(); await settle();
  if (await transform() !== 'none') throw Error('Menu close left sticky lift');
  await first.hover();
  const select = first.getByRole('button', { name: /^Select / });
  await select.hover();
  await app.getByRole('tooltip').filter({ hasText: 'Select' }).waitFor();
  await page.getByRole('textbox', { name: 'Test draft' }).hover();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/tool', async route => {
    if (route.request().postDataJSON()?.name === 'set_stashdock_favorite') await gate;
    await route.continue();
  });
  await first.hover();
  const favorite = first.getByRole('button', { name: /^(?:Unfavorite|Favorite) / });
  const oldFavorite = await favorite.getAttribute('aria-pressed');
  await favorite.click();
  await favorite.locator('xpath=self::*[@aria-busy="true"]').waitFor();
  const pending = await favorite.evaluate(el => ({ cursor: getComputedStyle(el).cursor, disabled: el.disabled }));
  if (pending.cursor !== 'progress' || pending.disabled) throw Error('Favorite forbidden cursor: ' + JSON.stringify(pending));
  release();
  await favorite.locator(`xpath=self::*[@aria-pressed="${oldFavorite === 'true' ? 'false' : 'true'}"]`).waitFor();
  await page.unroute('**/tool');
  await page.getByRole('textbox', { name: 'Test draft' }).hover(); await settle();
  if (await favorite.evaluate(el => getComputedStyle(el.parentElement).opacity) !== '0') throw Error('Favorite controls stuck after pointer exit');
  const layouts = [];
  for (const width of [320, 380, 390, 439, 600, 720, 768, 900, 1024, 1440]) {
    await iframe.evaluate((el, width) => { el.style.width = width + 'px'; }, width);
    await first.hover(); await settle();
    const result = await first.evaluate(el => {
      const action = el.querySelector('button[aria-label$="to chat"]');
      const footer = action.parentElement;
      const site = footer.firstElementChild;
      const a = action.getBoundingClientRect(), s = site.getBoundingClientRect();
      return { cardWidth: el.clientWidth, action: action.innerText, siteWidth: s.width,
        sameRow: Math.abs((a.top + a.bottom) / 2 - (s.top + s.bottom) / 2) < 1,
        noOverlap: s.right <= a.left, noOverflow: el.scrollWidth <= el.clientWidth };
    });
    if (!result.sameRow || !result.noOverlap || !result.noOverflow || result.siteWidth < 48) throw Error(JSON.stringify({ width, ...result }));
    layouts.push({ width, ...result });
  }
  await iframe.evaluate(el => { el.style.width = '439px'; });
  await first.hover();
  const add = first.getByRole('button', { name: /^Add .+ to chat$/ });
  await add.click();
  await page.locator('#attachments .chip').first().waitFor();
  await add.locator('xpath=self::*[@aria-description="Added to draft"]').waitFor();
  await settle();
  const request = await page.evaluate(() => window.testRequests[0]);
  if (request.params.content[0].type !== 'text' || !request.params.content[0]._meta['openai/title']) throw Error('Missing titled inline context');
  if (request.params._meta['openai/message'].send !== false) throw Error('Accidental send');
  if (await page.getByRole('textbox', { name: 'Test draft' }).inputValue() !== 'Keep this draft unchanged.') throw Error('Draft changed');
  await iframe.screenshot({ path: 'output/playwright/mcp-047-added-single-row.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await first.hover(); await settle();
  if (await transform() !== 'none') throw Error('Reduced motion card still travels');
  return { menuKeepsLift: true, menuCloseResets: true, selectTooltip: true, favoritePending: pending,
    controlsHideAfterFavorite: true, draftUnchanged: true, attachmentTitle: request.params.content[0]._meta['openai/title'], layouts };
}
