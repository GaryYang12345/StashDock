// Isolated desktop fixture: close animation must not dismiss a replacement menu.
async page => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/modal-layout.html');
  await page.setViewportSize({width: 1063, height: 900});
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', {name: 'Edit First', exact: true}).click();
    await page.getByRole('menuitem', {name: 'Edit card', exact: true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', {name: 'Close dialog', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await page.getByRole('button', {name: 'Edit Second', exact: true}).click();
    await page.waitForTimeout(220);
    if (await page.getByRole('menu').count() !== 1) throw Error('Exit focus dismissed replacement menu: ' + i);
    await page.keyboard.press('Escape'); await page.waitForTimeout(170);
  }
  return {closeAndImmediatelyOpenAnotherMenu: true, repetitions: 8};
}
