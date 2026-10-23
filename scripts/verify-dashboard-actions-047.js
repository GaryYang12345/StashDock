// Built desktop presentation in a browser, using built-in demo data only.
async page => {
  const first = page.getByRole('article', { includeHidden: true }).first();
  await first.waitFor();
  const settle = () => first.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  await first.hover(); await settle();
  await first.getByRole('button', { name: /^Edit / }).click();
  await page.getByRole('menuitem', { name: 'Edit content', exact: true }).hover(); await settle();
  if (await first.evaluate(el => getComputedStyle(el).transform) !== 'matrix(1, 0, 0, 1, 0, -2)') throw Error('Desktop menu loses lift');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Context library' }).hover(); await settle();
  if (await first.evaluate(el => getComputedStyle(el).transform) !== 'none') throw Error('Desktop lift sticks');
  await first.hover();
  await first.getByRole('button', { name: /^Add .+ to context$/ }).hover();
  await page.getByRole('tooltip').filter({ hasText: 'Select' }).waitFor();
  const layouts = [];
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await first.hover(); await settle();
    const result = await first.evaluate(el => {
      const action = el.querySelector('button[aria-label^="Copy "]');
      const source = action.parentElement.firstElementChild;
      const a = action.getBoundingClientRect(), s = source.getBoundingClientRect();
      return { cardWidth: el.clientWidth, action: action.innerText,
        sameRow: Math.abs((a.top + a.bottom) / 2 - (s.top + s.bottom) / 2) < 1,
        noOverlap: s.right <= a.left, noOverflow: el.scrollWidth <= el.clientWidth };
    });
    if (!result.sameRow || !result.noOverlap || !result.noOverflow) throw Error(JSON.stringify({ width, ...result }));
    layouts.push({ width, ...result });
  }
  await page.screenshot({ path: 'output/playwright/dashboard-047-single-row.png' });
  return { menuKeepsLift: true, menuCloseResets: true, selectTooltip: true, layouts, data: 'built-in demo only' };
}
