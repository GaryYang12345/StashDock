/** Bounded foreground cache. Never evict a running request: it owns a slot. */
export function createPreviewCache(render, { now = Date.now, maxEntries = 8, maxPending = 2, ttl = 180_000 } = {}) {
  const entries = new Map();
  const controller = new AbortController();
  return {
    signal: controller.signal,
    close: () => { controller.abort(); entries.clear(); },
    peek: url => {
      const entry = entries.get(url);
      return entry && (entry.pending || now() - entry.created < ttl) ? entry.promise : undefined;
    },
    lookup: async url => {
      if (controller.signal.aborted) throw Error('Screenshot cancelled');
      const prior = entries.get(url);
      if (prior && (prior.pending || now() - prior.created < ttl)) return prior.promise;
      if ([...entries.values()].filter(entry => entry.pending).length >= maxPending) throw Error('The preview renderer is busy. Retry the lookup in a moment.');
      if (entries.size >= maxEntries) {
        const settled = [...entries].find(([, entry]) => !entry.pending);
        if (settled) entries.delete(settled[0]);
      }
      const entry = { created: now(), pending: true, promise: Promise.resolve().then(() => {
        if (controller.signal.aborted) throw Error('Screenshot cancelled');
        return render(url, controller.signal);
      }) };
      entries.set(url, entry);
      entry.promise.then(() => { entry.pending = false; }, () => {
        entry.pending = false;
        if (entries.get(url) === entry) entries.delete(url);
      });
      return entry.promise;
    },
  };
}
