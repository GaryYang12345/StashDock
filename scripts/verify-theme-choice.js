// Visual and native-radio acceptance against isolated Desktop IPC only.
async page => {
  const errors = [], cases = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(() => sessionStorage.removeItem('settings-fixture'));
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const light = page.getByRole('radio', { name: 'Light', exact: true });
  const dark = page.getByRole('radio', { name: 'Dark', exact: true });
  await light.focus(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.querySelector('fieldset').getAttribute('aria-disabled') !== 'true');
  if (!await dark.evaluate(el => el === document.activeElement)) throw Error('Saving lost native radio keyboard focus');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light' && document.querySelector('input[value="system"]').checked);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  for (const locale of ['en', 'zh']) {
    if (locale === 'zh') {
      await page.getByRole('button', { name: 'Language: English', exact: true }).click();
      await page.getByRole('menuitem', { name: '简体中文', exact: true }).click();
    }
    const group = page.getByRole('group', { name: locale === 'en' ? 'Theme' : '主题', exact: true });
    for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 800 });
      const name = locale === 'en' ? theme === 'light' ? 'Light' : 'Dark' : theme === 'light' ? '浅色' : '深色';
      await page.getByRole('radio', { name, exact: true }).click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme && document.querySelector('fieldset').getAttribute('aria-disabled') !== 'true', theme);
      await group.scrollIntoViewIfNeeded();
      const result = await group.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return { overflow: el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth, radios: [...el.querySelectorAll('input')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, within: r.left >= bounds.left - 1 && r.right <= bounds.right + 1 }; }), checked: el.querySelectorAll(':checked').length };
      });
      if (result.overflow || result.checked !== 1 || result.radios.length !== 3 || result.radios.some(r => r.width < 44 || r.height < 44 || !r.within)) throw Error('Visual theme layout: ' + JSON.stringify({ width, locale, theme, result }));
      if ([390, 1024].includes(width)) await page.screenshot({ path: `output/playwright/theme-picker-${locale}-${theme}-${width}.png` });
      cases.push({ width, locale, theme });
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  return { cases, nativeArrowKeysAndFocus: true, automaticTheme: true, pageErrors: 0, realLibraryWrites: 0 };
}
