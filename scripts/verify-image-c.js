async page => {
  for (const theme of ['light', 'dark']) {
    await page.goto('http://127.0.0.1:18753/?theme=' + theme);
    await page.setViewportSize({ width: 1024, height: 900 });
    const card = page.locator('[data-reference-id="image"]');
    await card.waitFor();
    const colors = await card.locator('div[data-visual="image"]').evaluate(el => ({ cover: getComputedStyle(el).getPropertyValue('--visual-accent').trim(), blue: getComputedStyle(document.documentElement).getPropertyValue('--reference-blue').trim() }));
    if (colors.cover !== colors.blue) throw Error('Image tint is not blue');
    await card.screenshot({ path: 'output/playwright/image-c-' + theme + '.png' });
  }
  console.log('Option C cover and footer rendered in both themes.');
}
