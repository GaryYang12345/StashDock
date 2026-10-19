// Opt-in, DOM-only diagnostic for isolated rendered fixtures. It observes real
// pointer/keyboard interactions; it never drives the UI or touches library data.
if (new URL(location.href).searchParams.has('probe')) {
  const output = document.createElement('output');
  output.id = 'selection-motion-evidence';
  output.hidden = true;
  document.body.append(output);
  const runs: { value: string | null; label: string | null; frames: { t: number; x: number; y: number; width: number; opacity: string }[] }[] = [];
  const observe = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    const group = target?.closest('[role="group"]');
    if (!group || !target?.hasAttribute('aria-pressed')) return;
    const started = performance.now();
    const run = { value: target.getAttribute('data-value'), label: group.getAttribute('aria-label'), frames: [] as typeof runs[number]['frames'] };
    runs.push(run);
    if (runs.length > 12) runs.shift();
    const frame = () => {
      const selection = group.querySelector<HTMLElement>('[aria-pressed="true"] > [aria-hidden="true"]');
      if (selection) {
        const rect = selection.getBoundingClientRect();
        run.frames.push({ t: performance.now() - started, x: rect.x, y: rect.y, width: rect.width, opacity: getComputedStyle(selection).opacity });
      }
      output.textContent = JSON.stringify(runs);
      if (performance.now() - started < 800 && group.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  document.addEventListener('click', observe, true);
  document.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) observe(event); }, true);
}
