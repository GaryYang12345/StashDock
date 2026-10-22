import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import styles from './VirtualShelf.module.css';

type Props<T> = {
  items: T[];
  view: 'grid' | 'list';
  /** The scrolling viewport that also holds content above the shelf (notices). */
  scroller: HTMLElement | null;
  gridClassName: string;
  listClassName: string;
  /** Changes when the shown query or collection changes; results then start at the top. */
  resetKey: string;
  children: (item: T) => ReactNode;
};

// Renders only the rows near the viewport (plus a few either side), so a
// search, filter or a large library changes a bounded number of cards at once.
// Columns come from the shelf's own responsive grid; row heights are measured.
export function VirtualShelf<T>({ items, view, scroller, gridClassName, listClassName, resetKey, children }: Props<T>) {
  const probe = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 3, gap: 16 });
  const [offset, setOffset] = useState(0);
  const columns = view === 'grid' ? layout.columns : 1;
  const rows = useMemo(() => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += columns) result.push(items.slice(index, index + columns));
    return result;
  }, [items, columns]);

  useLayoutEffect(() => {
    const grid = probe.current, list = body.current;
    if (!list || !scroller) return;
    const measure = () => {
      if (grid) {
        const style = getComputedStyle(grid);
        const next = { columns: Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length), gap: parseFloat(style.rowGap) || 0 };
        setLayout(current => current.columns === next.columns && current.gap === next.gap ? current : next);
      }
      // Distance from the top of the scrolled content to the first row.
      setOffset(Math.round(list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (grid) observer.observe(grid);
    for (const node of [list.parentElement, list.parentElement?.previousElementSibling]) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [scroller, view]);

  const gap = view === 'grid' ? layout.gap : 0;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller,
    estimateSize: () => (view === 'grid' ? 300 : 84) + gap,
    // A hidden shelf (Settings open) measures 0; keep the estimate rather than
    // treating every row as empty and mounting the whole library.
    measureElement: element => element.getBoundingClientRect().height || (view === 'grid' ? 300 : 84) + gap,
    overscan: view === 'grid' ? 3 : 8,
    scrollMargin: offset,
    initialRect: { width: 1024, height: 900 },
  });

  const lastKey = useRef(resetKey);
  useLayoutEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    if (scroller && scroller.scrollTop > 0) scroller.scrollTop = 0;
  }, [resetKey, scroller]);

  return <div className={view === 'grid' ? styles.grid : listClassName}>
    {view === 'grid' && <div ref={probe} className={`${gridClassName} ${styles.probe}`} aria-hidden="true" />}
    <div ref={body} className={styles.body} style={{ height: Math.max(0, virtualizer.getTotalSize() - gap) }}>
      {virtualizer.getVirtualItems().map(row => <div key={row.key} data-index={row.index} data-shelf-row data-last={row.index === rows.length - 1 || undefined} ref={virtualizer.measureElement}
        className={view === 'grid' ? gridClassName : styles.listRow}
        style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`, paddingBottom: gap }}>
        {rows[row.index]?.map(children)}
      </div>)}
    </div>
  </div>;
}
