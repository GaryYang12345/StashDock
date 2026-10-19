async page => {
  await page.goto('http://127.0.0.1:18750/tests/fixtures/import-lifecycle.html');
  const count = () => page.locator('#parent-renders').textContent();
  const initial = await count();
  for (let run = 0; run < 3; run++) {
    await page.getByRole('button', { name: 'Import references', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByRole('tab', { name: 'Note', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Content', exact: true }).fill('Unsaved fixture draft');
    await page.waitForTimeout(1100); // Exercise delayed discovery while open.
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    if (await count() !== initial) throw Error('Opening/typing/closing rerendered the shelf owner');
  }
  await page.getByRole('button', { name: 'Import references', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  // Simulate host visibility changing outside the modal (native collapse).
  await page.getByRole('button', { name: 'Toggle host activity', exact: true, includeHidden: true }).evaluate(el => el.click());
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Import references', exact: true }).click();
  if (await page.getByRole('dialog').count()) throw Error('Inactive host opened import');
  await page.getByRole('button', { name: 'Toggle host activity', exact: true }).click();
  await page.getByRole('button', { name: 'Import references', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await dialog.getByRole('tab', { name: 'Note', exact: true }).click();
  const content = dialog.getByRole('textbox', { name: 'Content', exact: true });
  if (await content.inputValue()) throw Error('Completed close did not reset the draft');
  await content.fill('Canonical fixture note');
  await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  if (await page.locator('#saved-count').textContent() !== '1') throw Error('Save did not reach latest host callback');
  return { unchangedOwnerRendersAcrossThreeOpens: Number(initial), hostDeactivationCloses: true, inactiveHostCannotOpen: true, resetAfterClose: true, explicitSaveCount: 1, realLibraryWrites: 0 };
}
