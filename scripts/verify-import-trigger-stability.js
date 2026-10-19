// Isolated fixture with deliberately slow browser discovery; no library writes.
async page => {
  await page.goto('http://127.0.0.1:18749/tests/fixtures/desktop-import.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Import from', exact: true });
  await trigger.waitFor();
  const samples = await trigger.evaluate(button => new Promise(resolve => {
    const values = [], start = performance.now();
    function sample() {
      const slot = button.children[1], text = slot?.lastElementChild;
      values.push({ label: text?.textContent, width: button.offsetWidth, textTop: text?.offsetTop, transform: text ? getComputedStyle(text).transform : 'none', busy: button.parentElement.getAttribute('aria-busy') });
      if (performance.now() - start < 1400) requestAnimationFrame(sample); else resolve(values);
    }
    sample();
  }));
  if (samples.some(sample => sample.label !== 'Import from')) throw Error('Trigger label changes during discovery');
  const widths = samples.map(sample => sample.width);
  if (Math.max(...widths) - Math.min(...widths) > 1) throw Error('Trigger changes width: ' + JSON.stringify(widths));
  if (samples.some(sample => !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(sample.transform))) throw Error('Trigger label moves');
  if (!samples.some(sample => sample.busy === 'true') || !samples.some(sample => sample.busy === null)) throw Error('Discovery transition was not exercised');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Chrome', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  return { samples: samples.length, widthRange: [Math.min(...widths), Math.max(...widths)], labelStable: true, discoveryExercised: true, noLabelTranslation: true, menuStillWorks: true };
}
