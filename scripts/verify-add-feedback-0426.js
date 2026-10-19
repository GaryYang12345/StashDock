async page => {
  const results = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1063]) {
      await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      await page.setViewportSize({ width, height: 820 });
      await page.goto(`http://127.0.0.1:18747/?theme=${theme}`, { waitUntil: 'domcontentloaded' });
      const shelf = page.frameLocator('iframe');
      const card = shelf.getByRole('article').first();
      const button = card.getByRole('button', { name: /^Add .* to chat$/ });
      await card.hover();
      await button.click();
      await page.waitForFunction(() => document.querySelectorAll('#attachments > *').length === 1);
      await page.waitForTimeout(300);
      const success = await button.evaluate(el => ({ state: el.dataset.addState, color: getComputedStyle(el).backgroundColor, label: el.textContent.trim() }));
      if (success.state !== 'success' || !success.label.includes('Added') || await button.isDisabled()) throw Error(`Success feedback changed: ${JSON.stringify(success)}`);
      await page.screenshot({ path: `output/playwright/add-success-0426-${theme}-${width}.png` });
      await page.waitForTimeout(1900);
      const ready = await button.evaluate(el => ({ state: el.dataset.addState, color: getComputedStyle(el).backgroundColor, label: el.textContent.trim() }));
      if (ready.state !== 'ready' || ready.color === success.color || !/Add/.test(ready.label) || await button.isDisabled()) throw Error('Original Add did not return');
      await page.screenshot({ path: `output/playwright/add-ready-0426-${theme}-${width}.png` });
      results.push({ theme, width, success, ready });
    }
  }
  return results;
}
