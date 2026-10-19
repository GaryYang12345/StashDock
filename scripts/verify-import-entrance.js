// Rendered opening/height/focus regression. Isolated IPC; never saves user data.
async page => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1063, height: 900 });
  const fixture = page.url().includes(':18750/') ? 'http://127.0.0.1:18750/tests/fixtures/settings.html' : 'http://127.0.0.1:18749/tests/fixtures/settings.html';
  await page.goto(fixture, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const trigger = page.getByRole('button', { name: 'Import references', exact: true });
  await trigger.waitFor();
  const reports = [];
  for (let run = 0; run < 5; run++) {
    await page.evaluate(() => {
      window.entrance = { frames: [], clicked: 0, done: false };
      document.addEventListener('click', function start(event) {
        if (!event.target.closest('button')?.textContent.includes('Import references')) return;
        document.removeEventListener('click', start, true);
        const data = window.entrance; data.clicked = performance.now();
        function frame() {
          const time = performance.now();
          const node = document.querySelector('[role="dialog"][data-size="import"]');
          const css = node && getComputedStyle(node), rect = node?.getBoundingClientRect();
          const matrix = css && new DOMMatrixReadOnly(css.transform);
          data.frames.push({ time: time - data.clicked, exists: !!node, opacity: css ? Number(css.opacity) : 0, height: rect?.height, scale: matrix?.a ?? 1, y: matrix?.f });
          if (time - data.clicked < 800) requestAnimationFrame(frame);
          else data.done = true;
        }
        requestAnimationFrame(frame);
      }, true);
    });
    await trigger.click(); await page.waitForFunction(() => window.entrance.done);
    const report = await page.evaluate(() => {
      const frames = window.entrance.frames, visible = frames.filter(x => x.exists);
      const at = opacity => visible.find(x => x.opacity >= opacity)?.time;
      return { firstFrameMs: visible[0]?.time, visible90Ms: at(.9), visible99Ms: at(.99), heightDelta: Math.max(...visible.map(x => x.height)) - Math.min(...visible.map(x => x.height)), textNeverScaled: visible.every(x => x.scale === 1), rise: visible.map(x => ({ ms: x.time, y: x.y })) };
    });
    if (!report.textNeverScaled || report.heightDelta > .1) throw Error('Opening resized or scaled text: ' + JSON.stringify(report));
    if (report.visible99Ms - report.firstFrameMs > 250) throw Error('Entrance fade inherited height spring: ' + JSON.stringify(report));
    if (report.rise.some((frame, i, frames) => frame.y < -.1 || (i && frame.y > frames[i - 1].y + .1)) || !report.rise.some(frame => frame.y > 2 && frame.y < 14)) throw Error('Rise jumped or overshot: ' + JSON.stringify(report));
    reports.push({ ...report, rise: { start: report.rise[0]?.y, end: report.rise.at(-1)?.y, intermediateFrames: report.rise.filter(frame => frame.y > .2 && frame.y < 14).length } });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    if (!await trigger.evaluate(el => el === document.activeElement)) throw Error('Import focus did not return');
  }
  await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
  await page.waitForTimeout(500);
  const sizes = {}, transitions = [];
  for (const mode of ['Note', 'File', 'Link', 'File', 'Note']) {
    const before = await dialog.boundingBox();
    // Observe from the actual input event, not after the automation roundtrip:
    // on a busy machine that roundtrip can outlast the whole transition.
    await dialog.evaluate(el => {
      window.heightChange = { frames: [], done: false };
      el.addEventListener('click', function start() {
        const data = window.heightChange, started = performance.now();
        function frame() { const r = el.getBoundingClientRect(); data.frames.push({ height: r.height, center: r.y + r.height / 2 }); if (performance.now() - started < 700) requestAnimationFrame(frame); else data.done = true; }
        requestAnimationFrame(frame);
      }, { once: true, capture: true });
    });
    await dialog.getByRole('tab', { name: mode, exact: true }).click();
    await page.waitForFunction(() => window.heightChange.done);
    const frames = await page.evaluate(() => window.heightChange.frames);
    const final = await dialog.boundingBox(); sizes[mode] = final.height;
    const low = Math.min(before.height, final.height), high = Math.max(before.height, final.height);
    if (frames.some(x => x.height < low - 2 || x.height > high + 2 || Math.abs(x.center - 450) > 2)) throw Error('Height overshot or lost centering');
    if (high - low > 30 && !frames.some(x => x.height > low + 2 && x.height < high - 2)) throw Error('Height did not interpolate');
    transitions.push({ mode, before: before.height, after: final.height });
  }
  if (Math.max(...Object.values(sizes)) - Math.min(...Object.values(sizes)) < 60) throw Error('Import became fixed height');
  // Reverse while the height is moving, then close/reopen during exit.
  for (const mode of ['Link', 'File', 'Note', 'Link']) { await dialog.getByRole('tab', { name: mode, exact: true }).click(); await page.waitForTimeout(35); }
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+n');
  await page.getByRole('dialog').waitFor();
  if (await page.getByRole('dialog').count() !== 1) throw Error('Duplicate dialog on reversal');
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await trigger.click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(50);
  if (!await page.getByRole('dialog').evaluate(el => getComputedStyle(el).opacity === '1' && new DOMMatrixReadOnly(getComputedStyle(el).transform).f === 0)) throw Error('Reduced motion still travels');
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
  return { reports, transitions, reducedMotion: true, focusReturn: true, rapidReversal: true, realLibraryWrites: 0 };
}
