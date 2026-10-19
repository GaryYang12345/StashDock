async page => {
  // Run through playwright-cli run-code attached to the installed WebView.
  // The development server must be stopped before invoking this check.
  const loaded = await page.evaluate(() => ({
    origin: location.origin,
    native: !!window.__TAURI_INTERNALS__,
    packagedScripts: [...document.scripts].filter(script => script.src)
      .every(script => new URL(script.src).origin === location.origin),
  }));
  if (!loaded.native || !['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'].includes(loaded.origin) || !loaded.packagedScripts)
    throw new Error('The desktop is not running its packaged frontend.');

  const pages = page.context().browser().contexts().flatMap(context => context.pages());
  const panel = pages.find(candidate => !new URL(candidate.url()).searchParams.has('surface'));
  const folder = pages.find(candidate => new URL(candidate.url()).searchParams.get('surface') === 'folder');
  if (!panel || !folder) throw Error('Independent native panel and folder pages are missing.');
  page = panel;
  const open = folder.getByRole('button', { name: 'Open StashDock', exact: true });
  const activate = async button => { await button.focus(); await button.press('Enter'); };
  await page.getByRole('heading', { name: 'Context shelf', exact: true }).waitFor({ state: 'visible' });
  await activate(page.getByRole('button', { name: 'Import references', exact: true }));
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  for (const name of ['Note', 'File', 'Link']) {
    await activate(dialog.getByRole('tab', { name, exact: true }));
    await dialog.getByRole('tab', { name, exact: true }).waitFor({ state: 'visible' });
    if (await dialog.getByRole('tab', { name, exact: true }).getAttribute('aria-selected') !== 'true')
      throw new Error(`The ${name} import tab did not activate.`);
  }
  await activate(dialog.getByRole('button', { name: 'Import from', exact: true }));
  await activate(page.getByRole('menuitem', { name: 'Platforms', exact: true }));
  await dialog.getByRole('heading', { name: 'Platforms', exact: true }).waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Open X', exact: true }).waitFor({ state: 'visible' });
  if (await dialog.getByRole('button', { name: /Connect X|Disconnect X|Import all/ }).count()) throw Error('Retired platform UI is still packaged.');
  await activate(dialog.getByRole('button', { name: 'Back to Link', exact: true }));
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await activate(page.getByRole('button', { name: 'Minimize to folder', exact: true }));
  await page.waitForFunction(async () => (await window.__TAURI_INTERNALS__.invoke('desktop_window_status')).visible === 'folder');
  await activate(open);
  await page.waitForFunction(async () => (await window.__TAURI_INTERNALS__.invoke('desktop_window_status')).visible === 'panel');
  await page.getByRole('heading', { name: 'Context shelf', exact: true }).waitFor({ state: 'visible' });
  return { ...loaded, shelf: true, importTabs: true, singlePageCapture: true, minimizeReopen: true };
}
