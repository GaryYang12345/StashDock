async page => {
  await page.setViewportSize({ width: 1180, height: 720 });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await page.getByRole('button', { name: 'Tags (31)', exact: true }).click();
  const heading = page.getByRole('button', { name: 'Tags (31)', exact: true });
  const before = await heading.boundingBox();
  const region = page.getByRole('region', { name: 'Tag filters', exact: true });
  const scrolled = await region.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
  if (!scrolled) throw Error('Long tag list did not scroll');
  const after = await heading.boundingBox();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Tags heading moved with its list');
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({ path: 'output/playwright/sidebar-fixed-tags.png' });
  await heading.click(); await heading.click();
  if (await region.evaluate(el => el.scrollTop) !== scrolled) throw Error('Tag disclosure reset scroll');
  console.log('Tags heading and Settings remain fixed; only tags scroll; collapse retains scroll.');
}
