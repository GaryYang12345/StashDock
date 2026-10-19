// Audit the actual Arc label box, not text's optical shape beside an icon.
async page => {
  await page.goto('http://127.0.0.1:18747/');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const frame = page.locator('iframe');
  const app = page.frameLocator('iframe');
  const first = app.getByRole('article', { includeHidden: true }).first();
  await first.waitFor();
  const audit = async name => {
    const result = await app.locator('body').evaluate(async body => {
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));
      const buttons = [...body.querySelectorAll('button')].filter(el => el.querySelector('[class*="labelSlot"]') && el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }));
      const rows = buttons.map(el => {
        const css = getComputedStyle(el), box = el.getBoundingClientRect();
        const label = el.querySelector('[class*="labelSlot"]').getBoundingClientRect();
        return { label: el.getAttribute('aria-label') || el.innerText, font: css.fontSize,
          weight: css.fontWeight, left: css.paddingLeft, right: css.paddingRight,
          height: css.minHeight, centerError: Math.abs(label.left - box.left - (box.right - label.right)),
          center: css.justifyContent === 'center' };
      });
      return { count: rows.length, failures: rows.filter(r => r.font !== '14px' || r.weight !== '500' || r.left !== r.right || parseFloat(r.height) < 36 || (r.center && r.centerError > 1)) };
    });
    if (result.failures.length) throw Error(JSON.stringify({ name, ...result }));
    return { name, count: result.count };
  };
  const views = [];
  for (const width of [390, 439, 768, 1024, 1440]) {
    await frame.evaluate((el, w) => { el.style.width = w + 'px'; }, width);
    await first.hover();
    views.push(await audit('shelf-' + width));
  }
  await first.getByRole('button', { name: /^Select / }).click();
  views.push(await audit('selection bar'));
  await app.getByRole('button', { name: 'Clear selection' }).click();
  await first.getByRole('button', { name: /^More options / }).click();
  await app.getByRole('menuitem', { name: 'Edit card', exact: true }).click();
  await app.getByRole('dialog').ariaSnapshot();
  views.push(await audit('edit card and tag suggestions'));
  await app.getByRole('button', { name: 'Close editor', exact: true }).click();
  await first.hover();
  await first.getByRole('button', { name: /^More options / }).click();
  await app.getByRole('menuitem', { name: 'Edit content', exact: true }).click();
  await app.getByRole('dialog').ariaSnapshot();
  views.push(await audit('edit content'));
  await app.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await app.getByRole('button', { name: 'Import references', exact: true }).click();
  await app.getByRole('dialog').ariaSnapshot();
  views.push(await audit('import dialog'));
  const tabs = await app.getByRole('tab').all();
  for (const tab of tabs) {
    const name = await tab.innerText(); await tab.click();
    views.push(await audit('import ' + name));
  }
  await page.keyboard.press('Escape');
  await app.getByRole('button', { name: 'Tags', exact: true }).click();
  await app.locator('body').ariaSnapshot();
  views.push(await audit('tag filter'));
  await page.keyboard.press('Escape');
  // Short URLs should not expand to push the visit icon toward the action.
  await frame.evaluate(el => { el.style.width = '1440px'; });
  const link = await app.getByRole('article').nth(1).evaluate(el => {
    const button = el.querySelector('button[aria-label^="Open "]');
    const text = button.previousElementSibling.querySelector('[class*="label_"]');
    return { gap: button.getBoundingClientRect().left - text.getBoundingClientRect().right,
      sourceFlex: getComputedStyle(button.previousElementSibling).flexGrow };
  });
  if (link.gap > 5 || link.sourceFlex !== '0') throw Error('URL icon detached: ' + JSON.stringify(link));
  await frame.evaluate(el => { el.style.width = '439px'; });
  await first.hover();
  await frame.screenshot({ path: 'output/playwright/mcp-048-standard-buttons.png' });
  return { views, urlIcon: link, font: '14px / 500', paddingSymmetric: true, centeredLabelGroups: true };
}
