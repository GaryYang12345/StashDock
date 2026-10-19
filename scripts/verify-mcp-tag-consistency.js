// Disposable mcp-test library only. Never invoke against the live Codex App.
async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 439, height: 1000 });
  await page.goto('http://127.0.0.1:18747/');
  const app = page.frameLocator('iframe');
  const card = app.getByRole('article').first(); await card.waitFor();
  const originalCount = await app.getByRole('article').count();
  const more = card.getByRole('button', { name: /^More options/ });
  await more.click();
  const contentAction = app.getByRole('menuitem', { name: 'Edit content', exact: true });
  if (await contentAction.locator('svg.lucide-file-text').count() !== 1) throw Error('Wrong content icon');
  if (await contentAction.locator('svg').getAttribute('stroke-width') !== '1.75') throw Error('Wrong icon stroke');
  await app.getByRole('menuitem', { name: 'Edit card', exact: true }).click();
  const editor = app.getByRole('dialog', { name: 'Edit card', exact: true });
  const existing = editor.getByRole('button', { name: /^Remove / });
  while (await existing.count()) {
    const name = await existing.first().getAttribute('aria-label');
    await editor.getByRole('button', { name, exact: true }).click();
    await editor.getByRole('button', { name, exact: true }).waitFor({ state: 'hidden' });
  }
  const input = editor.getByRole('textbox', { name: 'Tags', exact: true });
  for (let i = 1; i <= 10; i++) { await input.fill('Consistency tag ' + i); await input.press('Enter'); }
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  const tags = app.getByRole('button', { name: 'Tags', exact: true });
  await tags.click();
  const rows = app.getByRole('region', { name: 'Library tags', exact: true });
  await rows.getByRole('button', { name: 'Filter by Consistency tag 10', exact: true }).waitFor();
  if (await app.getByText('Manage tags', { exact: true }).count() || await app.getByText('Browse all tags', { exact: true }).count()) throw Error('Legacy tag actions remain');
  const target = rows.getByRole('button', { name: 'Filter by Consistency tag 1', exact: true });
  await target.click({ button: 'right' });
  const menu = app.getByRole('menu', { name: 'Actions for tag Consistency tag 1', exact: true });
  await menu.waitFor();
  if (await menu.getByRole('menuitem').count() !== 2) throw Error('Tag menu must contain only rename/remove');
  if (await menu.getByRole('menuitem', { name: 'Rename tag' }).locator('svg.lucide-pencil').count() !== 1) throw Error('Wrong rename icon');
  await page.screenshot({ path: 'output/playwright/mcp-046-tag-context.png' });
  await menu.getByRole('menuitem', { name: 'Rename tag', exact: true }).click();
  const rename = app.getByRole('dialog', { name: 'Rename tag', exact: true });
  await rename.getByRole('textbox', { name: 'Tag name', exact: true }).fill('Renamed consistency');
  await rename.getByRole('button', { name: 'Save name', exact: true }).click(); await rename.waitFor({ state: 'hidden' });
  await tags.click();
  const renamed = rows.getByRole('button', { name: 'Filter by Renamed consistency', exact: true });
  await renamed.waitFor();
  if (await rows.getByRole('button', { name: 'Filter by Consistency tag 1', exact: true }).count()) throw Error('Old tag remains');
  await renamed.click();
  const active = app.getByRole('button', { name: 'Renamed consistency', exact: true });
  await active.click();
  await rows.getByRole('button', { name: 'Filter by Renamed consistency', exact: true }).click({ button: 'right' });
  await app.getByRole('menuitem', { name: 'Remove tag', exact: true }).click();
  const remove = app.getByRole('dialog', { name: 'Remove tag?', exact: true });
  await remove.getByRole('button', { name: 'Cancel', exact: true }).click(); await remove.waitFor({ state: 'hidden' });
  await active.click();
  await rows.getByRole('button', { name: 'Filter by Renamed consistency', exact: true }).click({ button: 'right' });
  await app.getByRole('menuitem', { name: 'Remove tag', exact: true }).click();
  await remove.getByRole('button', { name: 'Remove tag', exact: true }).click(); await remove.waitFor({ state: 'hidden' });
  await tags.waitFor(); await tags.click();
  if (await rows.getByRole('button', { name: 'Filter by Renamed consistency', exact: true }).count()) throw Error('Removed tag remains');
  await rows.getByRole('button', { name: 'All tags', exact: true }).click();
  await page.waitForTimeout(400);
  if (await app.getByRole('article').count() !== originalCount) throw Error('Tag removal deleted references');
  if (await page.getByRole('textbox', { name: 'Test draft' }).inputValue() !== 'Keep this draft unchanged.') throw Error('User draft changed');
  if (errors.length) throw Error(errors.join('\n'));
  return { sharedContentIcon: true, allTenTagsReachable: true, renameAndRemove: true, removalConfirmed: true, cancelSafe: true, referencesPreserved: true, draftUntouched: true, errors };
}
