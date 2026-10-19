async page => {
  await page.goto('http://127.0.0.1:18748/dashboard');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const first = page.getByRole('article', { includeHidden: true }).first();
  await first.waitFor();
  const audit = async name => {
    await first.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
    const rows = await page.locator('body').evaluate(body => [...body.querySelectorAll('button')].filter(el => el.querySelector('[class*="labelSlot"]') && el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })).map(el => {
      const css = getComputedStyle(el), box = el.getBoundingClientRect(), label = el.querySelector('[class*="labelSlot"]').getBoundingClientRect();
      return { name: el.getAttribute('aria-label') || el.innerText, font: css.fontSize, weight: css.fontWeight, left: css.paddingLeft, right: css.paddingRight, height: css.minHeight, centerError: css.justifyContent === 'center' ? Math.abs(label.left - box.left - (box.right - label.right)) : 0 };
    }));
    const failures = rows.filter(r => r.font !== '14px' || r.weight !== '500' || r.left !== r.right || parseFloat(r.height) < 36 || r.centerError > 1);
    if (failures.length) throw Error(JSON.stringify({ name, failures }));
    return { name, count: rows.length };
  };
  const results = [];
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await first.hover();
    results.push(await audit('dashboard-' + width));
  }
  await first.getByRole('button', { name: /^Add .+ to context$/ }).click();
  results.push(await audit('selection bar'));
  await first.getByRole('button', { name: /^Edit / }).click();
  await page.getByRole('menuitem', { name: 'Edit card', exact: true }).click();
  results.push(await audit('edit card'));
  await page.getByRole('button', { name: 'Close editor', exact: true }).click();
  await page.getByRole('button', { name: 'Import references', exact: true }).click();
  results.push(await audit('import'));
  await page.keyboard.press('Escape');
  return { results, library: 'demo only' };
}
