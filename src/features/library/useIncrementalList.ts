import { startTransition, useEffect, useState } from 'react';

/**
 * Shows a long list in frame-sized chunks so no single commit mounts the
 * whole shelf. Cards that were already on screen stay mounted when the list
 * changes (the shown count carries over), and each further chunk is a
 * transition, so typing or clicking interrupts it.
 */
export function useIncrementalList<T>(items: T[], chunk = 24): T[] {
  const [state, setState] = useState({ items, limit: chunk });
  let { limit } = state;
  if (state.items !== items) {
    limit = Math.max(chunk, Math.min(state.limit, state.items.length));
    setState({ items, limit });
  }
  const complete = limit >= items.length;
  useEffect(() => {
    if (complete) return;
    const timer = setTimeout(() => startTransition(() => setState(current => current.items === items ? { items, limit: current.limit + chunk } : current)), 0);
    return () => clearTimeout(timer);
  }, [items, limit, complete, chunk]);
  return complete ? items : items.slice(0, limit);
}
