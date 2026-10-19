// Isolated MCP host only: never writes to a real conversation or library.
async page => {
  const reports = [];
  const state = button => button.evaluate(el => ({
    state: el.dataset.addState, disabled: el.disabled,
    blocked: el.getAttribute('aria-disabled'), busy: el.getAttribute('aria-busy'),
    opacity: Number(getComputedStyle(el).opacity), pointer: getComputedStyle(el).pointerEvents,
    background: getComputedStyle(el).backgroundColor,
  }));
  for (const theme of ['light', 'dark']) for (const width of [390, 1063]) for (const view of ['Grid', 'List']) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    await page.goto(`http://127.0.0.1:18752/?theme=${theme}`);
    const shelf = page.frameLocator('iframe');
    await shelf.getByRole('button', { name: view, exact: true }).click();
    const cards = shelf.getByRole('article');
    await cards.nth(1).waitFor();
    const first = cards.nth(0).getByRole('button', { name: /^Add .* to chat$/ });
    const peer = cards.nth(1).getByRole('button', { name: /^Add .* to chat$/ });
    await cards.nth(1).hover();
    await page.waitForTimeout(200);
    const normalPeer = await state(peer);
    let release, started, preparations = 0;
    const activeRoutes = new Set();
    const gate = new Promise(resolve => { release = resolve; });
    const preparation = new Promise(resolve => { started = resolve; });
    const route = request => {
      const handling = (async () => {
        if (request.request().method() === 'POST' && request.request().postDataJSON().name === 'prepare_stashdock_attachment') {
          preparations++; started(); await gate;
        }
        await request.continue();
      })();
      activeRoutes.add(handling);
      return handling.finally(() => activeRoutes.delete(handling));
    };
    await page.route('**/tool', route);
    try {
      await cards.nth(0).hover();
      await first.click();
      await preparation;
      await page.waitForTimeout(250);
      const pending = await state(first), hiddenPeer = await state(peer);
      if (!pending.busy || pending.disabled) throw Error('Clicked card did not retain Arc loading');
      if (hiddenPeer.disabled || hiddenPeer.opacity !== 0 || hiddenPeer.pointer !== 'none' || hiddenPeer.state !== 'ready') throw Error(`Peer revealed/dimmed: ${JSON.stringify(hiddenPeer)}`);
      await cards.nth(1).hover();
      await page.waitForTimeout(200);
      const hoveredPeer = await state(peer);
      if (hoveredPeer.background !== normalPeer.background || hoveredPeer.opacity !== normalPeer.opacity || hoveredPeer.disabled) throw Error(`Peer color changed: ${JSON.stringify({ normalPeer, hoveredPeer })}`);
      // Arc exposes the in-flight lock without disabled opacity; actual handler still guards it.
      await peer.dispatchEvent('click');
      await first.dispatchEvent('click');
      if (preparations !== 1) throw Error('Concurrent presses reached transport');
      await page.screenshot({ path: `output/playwright/add-peer-pending-${theme}-${width}-${view}.png` });
      release();
      await page.waitForFunction(() => document.querySelectorAll('#attachments > *').length === 1);
      await page.waitForTimeout(300);
      const success = await state(first), peerAfter = await state(peer);
      if (success.state !== 'success' || success.disabled || peerAfter.state !== 'ready' || peerAfter.blocked) throw Error('Acknowledgement leaked to peer');
      await cards.nth(0).hover();
      await page.screenshot({ path: `output/playwright/add-peer-success-${theme}-${width}-${view}.png` });
      await page.waitForTimeout(1850);
      if ((await state(first)).state !== 'ready') throw Error('Temporary Added did not reset');
      await page.getByRole('button', { name: 'Remove test attachment' }).click();
      await cards.nth(0).hover();
      await first.click();
      await page.waitForFunction(() => document.querySelectorAll('#attachments > *').length === 1);
      if (preparations !== 2) throw Error('Intentional repeat was blocked');
      reports.push({ theme, width, view, pending, hiddenPeer, hoveredPeer, success, preparations });
    } finally { release(); await Promise.all([...activeRoutes]); await page.unroute('**/tool', route); }
  }
  await page.goto('http://127.0.0.1:18752/?reject=1');
  let shelf = page.frameLocator('iframe');
  let cards = shelf.getByRole('article');
  let first = cards.first().getByRole('button', { name: /^Add .* to chat$/ });
  await cards.first().hover();
  await first.click();
  await shelf.getByText(/Simulated host rejection/).waitFor();
  if ((await state(first)).state !== 'ready' || await first.isDisabled() || await page.locator('#attachments > *').count()) throw Error('Rejection became success or a permanent lock');
  await first.click();
  await page.waitForFunction(() => window.testRequests.length === 2);
  reports.push({ rejection: 'ready and retryable' });

  await page.goto('http://127.0.0.1:18752/');
  shelf = page.frameLocator('iframe'); cards = shelf.getByRole('article');
  await cards.nth(1).waitFor();
  for (const index of [0, 1]) {
    await cards.nth(index).hover();
    await cards.nth(index).getByRole('button', { name: /to context$/ }).click();
  }
  const bulk = shelf.getByRole('button', { name: 'Add to chat', exact: true });
  await bulk.click();
  await page.waitForFunction(() => document.querySelectorAll('#attachments > *').length === 1);
  await page.waitForTimeout(300);
  for (const index of [0, 1]) if ((await state(cards.nth(index).getByRole('button', { name: /^Add .* to chat$/ }))).state !== 'success') throw Error('Bulk confirmation missing');
  if ((await state(cards.nth(2).getByRole('button', { name: /^Add .* to chat$/ }))).state !== 'ready') throw Error('Bulk feedback leaked to unselected card');
  await page.waitForTimeout(1850);
  await bulk.click();
  await page.waitForFunction(() => document.querySelectorAll('#attachments > *').length === 2);
  reports.push({ bulk: 'selected success only, reset and repeat allowed' });
  return reports;
}
