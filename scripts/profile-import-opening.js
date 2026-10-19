// Read-only diagnostic on isolated IPC fixture, not the live library.
async page => {
  const fixture = page.url().includes(':18750/') ? 'http://127.0.0.1:18750/tests/fixtures/settings.html' : 'http://127.0.0.1:18749/tests/fixtures/settings.html';
  await page.goto(fixture, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Import references', exact: true }).waitFor();
  const client = await page.context().newCDPSession(page);
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: 500 });
  const reports = [];
  for (let run = 0; run < 4; run++) {
    const variant = run < 2 ? 'current' : 'natural-initial-height-test-only';
    await page.evaluate(variant => {
      document.getElementById('profile-height-override')?.remove();
      if (variant !== 'current') { const style = document.createElement('style'); style.id = 'profile-height-override'; style.textContent = '[role="dialog"][data-size="import"] { height:auto !important; }'; document.head.append(style); }
      window.importProfile = { click: 0, frames: [] };
      document.addEventListener('click', function start(event) {
        if (!event.target.closest('button')?.textContent.includes('Import references')) return;
        document.removeEventListener('click', start, true);
        const data = window.importProfile; data.click = performance.now();
        function frame() {
          const now = performance.now(), el = document.querySelector('[role="dialog"]');
          data.frames.push({ ms: now - data.click, mounted: !!el, opacity: el ? Number(getComputedStyle(el).opacity) : 0 });
          if (now - data.click < 800) requestAnimationFrame(frame); else data.done = true;
        }
        requestAnimationFrame(frame);
      }, true);
    }, variant);
    const events = [];
    const collect = event => events.push(...event.value);
    client.on('Tracing.dataCollected', collect);
    await client.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' });
    await client.send('Profiler.start');
    await page.getByRole('button', { name: 'Import references', exact: true }).click();
    await page.waitForFunction(() => window.importProfile.done);
    const { profile } = await client.send('Profiler.stop');
    const completed = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
    await client.send('Tracing.end'); await completed;
    client.off('Tracing.dataCollected', collect);
    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    const totals = new Map();
    profile.samples.forEach((id, i) => {
      const f = nodes.get(id).callFrame, key = `${f.functionName || '(anonymous)'} ${f.url.split('/').slice(-1)[0]}:${f.lineNumber + 1}`;
      totals.set(key, (totals.get(key) || 0) + profile.timeDeltas[i] / 1000);
    });
    const timeline = new Map();
    for (const event of events) if (event.ph === 'X' && ['Layout', 'UpdateLayoutTree', 'Paint', 'FunctionCall', 'EventDispatch', 'RunTask', 'RecalculateStyles'].includes(event.name)) {
      timeline.set(event.name, (timeline.get(event.name) || 0) + (event.dur || 0) / 1000);
    }
    const click = events.find(e => e.name === 'EventDispatch' && e.args?.data?.type === 'click')?.ts;
    const lateRendering = {};
    for (const name of ['Layout', 'UpdateLayoutTree', 'Paint']) {
      const late = events.filter(e => e.name === name && e.ph === 'X' && e.ts > click + 300000 && e.ts < click + 800000);
      lateRendering[name] = { count: late.length, ms: late.reduce((sum, e) => sum + (e.dur || 0) / 1000, 0) };
    }
    reports.push({ run, variant, lateRendering, samplesMs: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 25), timelineMs: Object.fromEntries(timeline), frames: await page.evaluate(() => window.importProfile.frames.filter((x, i) => i < 8 || i % 12 === 0)) });
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('article').first().waitFor();
  }
  await page.evaluate(() => document.getElementById('profile-height-override')?.remove());
  await client.detach();
  return { fixture, reports, realLibraryWrites: 0, productionModified: false };
}
