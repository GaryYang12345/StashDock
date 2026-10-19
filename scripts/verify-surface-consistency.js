// Run with playwright-cli run-code. Own development harness, never a host composer.
async page => {
  const results = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:18747/?theme=' + theme);
      await page.bringToFront();
      const frame = page.frameLocator('iframe');
      const first = frame.locator('article').first();
      await first.waitFor();
      await frame.locator('main').evaluate(() => document.fonts.ready);
      // The iframe header is outside its scroll area. Bring the entire card
      // below it before hovering, rather than hovering a partially clipped title.
      await first.evaluate(el => el.scrollIntoView({ block: 'start' }));
      const add = first.getByRole('button', { name: /^Add .* to chat$/ });
      await page.mouse.move(1, 1);
      await page.waitForTimeout(700);
      if (await add.evaluate(el => getComputedStyle(el).opacity) !== '0') throw Error('Idle action visible');
      // At wide harness widths the large preview exceeds one viewport. Hover
      // the title so the footer action is painted before measuring its fade.
      await first.locator('h3').hover();
      await page.waitForTimeout(700);
      if (await add.evaluate(el => getComputedStyle(el).opacity) !== '1') throw Error('Hover action missing: ' + JSON.stringify(await add.evaluate(el => ({ opacity: getComputedStyle(el).opacity, hover: el.closest('article').matches(':hover'), classes: el.className, width: innerWidth }))));
      await first.getByRole('button', { name: /^Select / }).click();
      const footer = frame.locator('footer');
      await footer.waitFor();
      const controls = await footer.getByRole('button').evaluateAll(els => els.map(el => el.getAttribute('aria-label') || el.textContent));
      if (controls[0] !== 'Clear selection' || !controls[1].includes('Add to chat')) throw Error('Footer action order differs');
      const spacing = await footer.locator('p').evaluate(el => el.getBoundingClientRect().left - el.parentElement.parentElement.getBoundingClientRect().left);
      if (spacing < 12) throw Error('Selection summary lacks padding');
      const search = frame.getByRole('searchbox');
      await search.click();
      const border = await search.evaluate(el => getComputedStyle(el.parentElement).borderColor);
      const overflow = await frame.locator('main').evaluate(el => el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw Error('Horizontal overflow at ' + width);
      const primary = footer.getByRole('button').nth(1);
      const initialWidth = (await primary.boundingBox()).width;
      await primary.click();
      await primary.filter({ hasText: 'Added' }).waitFor();
      const samples = [];
      for (let i = 0; i < 8; i++) { samples.push((await primary.boundingBox()).width); await page.waitForTimeout(60); }
      if (Math.abs(samples.at(-1) - initialWidth) < 20 || new Set(samples.map(n => Math.round(n))).size < 3) throw Error('Button width did not morph');
      if (await page.locator('#draft').inputValue() !== 'Keep this draft unchanged.') throw Error('Draft was replaced');
      await page.mouse.move(1, 1); await page.waitForTimeout(220);
      if (await add.evaluate(el => getComputedStyle(el).opacity) !== '0') throw Error('Pointer focus pins action');
      if (width === 390) await page.screenshot({ path: 'output/playwright/mcp-consistency-' + theme + '.png' });
      results.push({ theme, width, spacing, border, buttonWidths: samples, overflow });
    }
  }
  return results;
}
