// Read-only product diagnosis. Isolated IPC fixture; no production edits/data.
async page => {
  const reports = [];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://127.0.0.1:18749/tests/fixtures/settings.html');
  const trigger = page.getByRole('button', { name: 'Import references', exact: true });
  await trigger.waitFor(); await trigger.hover(); await page.waitForTimeout(1500);
  for (let run = 0; run < 5; run++) {
    const variant = run < 3 ? 'current' : 'no-opacity-test-only';
    await page.evaluate(variant => {
      window.entranceDiagnosis = { frames: [], resizeCallbacks: 0, longTasks: [], clicked: 0 };
      const data = window.entranceDiagnosis;
      document.getElementById('diagnostic-opacity-override')?.remove();
      if (variant !== 'current') {
        const style = document.createElement('style'); style.id = 'diagnostic-opacity-override';
        style.textContent = '[role="dialog"][data-size="import"] { opacity: 1 !important; }';
        document.head.append(style);
      }
      data.observer = new PerformanceObserver(list => data.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))));
      data.observer.observe({ type: 'longtask', buffered: false });
      document.addEventListener('click', function start(event) {
        if (!event.target.closest('button')?.textContent.includes('Import references')) return;
        document.removeEventListener('click', start, true);
        data.clicked = performance.now();
        function frame(time) {
          const node = document.querySelector('[role="dialog"][data-size="import"]');
          const css = node && getComputedStyle(node), rect = node?.getBoundingClientRect();
          data.frames.push({ time: time - data.clicked, exists: !!node, opacity: css ? Number(css.opacity) : 0, height: rect?.height, transform: css?.transform });
          if (time - data.clicked < 1400) requestAnimationFrame(frame);
          else { data.observer.disconnect(); data.done = true; }
        }
        requestAnimationFrame(frame);
      }, true);
    }, variant);
    await trigger.click();
    await page.waitForFunction(() => window.entranceDiagnosis.done);
    reports.push({ variant, ...await page.evaluate(() => {
      const d = window.entranceDiagnosis, f = d.frames;
      const at = opacity => f.find(x => x.exists && x.opacity >= opacity)?.time;
      const gaps = f.slice(1).map((x, i) => x.time - f[i].time);
      const heights = f.filter(x => x.exists).map(x => x.height);
      return { firstDialogFrameMs: f.find(x => x.exists)?.time, visible50Ms: at(.5), visible90Ms: at(.9), visible99Ms: at(.99), worstFrameGapMs: Math.max(...gaps), gapsOver32ms: gaps.filter(x => x > 32).length, heightRange: [Math.min(...heights), Math.max(...heights)], longTasks: d.longTasks.filter(x => x.start >= d.clicked).map(x => Number(x.duration.toFixed(1))), frames: f.filter((x, i) => i % 6 === 0) };
    }) });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('article').first().waitFor(); await page.waitForTimeout(250);
  }
  return { fixture: 'shared Desktop dialog, native IPC mocked, normal motion', reports, realLibraryWrites: 0, productCodeModified: false };
}
