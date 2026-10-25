import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue, type TargetAndTransition, type Variants } from 'motion/react';
import { X } from 'lucide-react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import { FolderSearchCard } from '../../../src/components/FolderSearchCard';
import { SearchField } from '../../../src/components/arc/search-field/search-field';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { buildContext } from '../../../src/lib/context-format.mjs';
import { referenceDragPayload } from '../../../src/lib/reference-drag';
import folderControls from '../../../src/components/FloatingFolder.module.css';
import styles from '../../../src/features/folder-search/FolderSearch.module.css';
import type { StashItem } from '../../../src/types';
import { demoLibrary, matches } from '../demo-data';
import { useSite } from './useSite';
import './floating.css';

// A page-sized copy of the desktop's floating folder and its quick search
// (FloatingFolder, FolderSearch): the same artwork, styles, cover flow and timing.
// Only the native window, region and file transfer are replaced by the page.
export const REFERENCE_TYPE = 'application/x-stashdock-reference';
const FIELD = 184, FLOW = 460, CARD = 232;
/** The search window: 480 x 316, its bottom 40px over the folder's transparent top. */
const WINDOW_W = 480, WINDOW_H = 316, OVERLAP = 40, FOLDER = 144;
const INTENT_MS = 180, SEARCH_DELAY = 140, COPIED_MS = 1800, RESULT_LIMIT = 24;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mod = (value: number, size: number) => ((value % size) + size) % size;
const cubic = (ease: readonly number[]) => [...ease] as [number, number, number, number];

function place(d: number) {
  const a = Math.abs(d), s = Math.sign(d), near = Math.min(a, 1);
  const x = s * (a <= 1 ? a * CARD * 0.47 : CARD * 0.47 + (a - 1) * CARD * 0.2);
  const scale = 1 - near * 0.06;
  const opacity = a <= 1 ? 1 - a * 0.25 : Math.max(0, 0.75 - (a - 1) * 1.1);
  return { transform: `translateX(${x}px) translateZ(${-near * 150 - Math.max(0, a - 1) * 80}px) rotateY(${-clamp(d, -1, 1) * 48}deg) scale(${scale})`, opacity, z: 100 - Math.round(a * 10) };
}

function Slot({ virtual, pos, children }: { virtual: number; pos: MotionValue<number>; children: ReactNode }) {
  const transform = useTransform(pos, p => place(virtual - p).transform);
  const opacity = useTransform(pos, p => place(virtual - p).opacity);
  const zIndex = useTransform(pos, p => place(virtual - p).z);
  return <motion.div className={styles.slot} style={{ transform, opacity, zIndex }}>{children}</motion.div>;
}

function Flow({ items, pos, index, copiedId, go, onCopy, onOpen, onDragStart, onDragEnd }: {
  items: StashItem[]; pos: MotionValue<number>; index: number; copiedId: string; go: (next: number) => void;
  onCopy: (item: StashItem) => void; onOpen: (item: StashItem) => void; onDragStart: (item: StashItem, event: DragEvent<HTMLElement>) => void; onDragEnd: () => void;
}) {
  const [base, setBase] = useState(0);
  useMotionValueEvent(pos, 'change', value => { const next = Math.round(value); setBase(current => current === next ? current : next); });
  const loop = items.length >= 3, slots: { virtual: number; item: StashItem }[] = [];
  for (let k = -2; k <= 2; k++) {
    const virtual = base + k;
    if (!loop && (virtual < 0 || virtual >= items.length)) continue;
    slots.push({ virtual, item: items[mod(virtual, items.length)] });
  }
  return <div className={styles.flow}><div className={styles.stage3d}>
    {slots.map(({ virtual, item }) => <Slot key={virtual} virtual={virtual} pos={pos}>
      <FolderSearchCard item={item} current={virtual === index} copied={copiedId === item.id} onCopy={() => onCopy(item)}
        onActivate={() => virtual === index ? onOpen(item) : go(virtual)}
        onDragStart={event => onDragStart(item, event)} onDragEnd={onDragEnd} />
    </Slot>)}
  </div></div>;
}

const panelMotion = (reduced: boolean | null): Variants => ({ hidden: {}, shown: {}, gone: { transition: { staggerChildren: reduced ? 0 : 0.07 } } });
const fieldMotion = (reduced: boolean | null): Variants => ({
  hidden: { opacity: 0, y: 18, scaleX: 0.78, scaleY: 0.6, filter: `blur(${motionTokens.blur.soft}px)` },
  shown: { opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: cubic(motionTokens.ease.enter) }, filter: { duration: motionTokens.duration.standard } } },
  gone: { opacity: 0, y: 18, scaleX: 0.78, scaleY: 0.6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: cubic(motionTokens.ease.inOut), opacity: { duration: motionTokens.duration.fast, delay: 0.06 } } },
});
const frameMotion = (reduced: boolean | null): Variants => ({
  hidden: {}, shown: { opacity: 1, y: 0, scale: 1 },
  gone: { opacity: 0, y: 22, scale: 0.94, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: reduced ? 0 : motionTokens.duration.exit, ease: cubic(motionTokens.ease.standard) } },
});
const rise = (reduced: boolean | null, y: number): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } => ({
  initial: { opacity: 0, y, scale: 0.96, filter: `blur(${motionTokens.blur.soft}px)` },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: cubic(motionTokens.ease.enter) }, filter: { duration: motionTokens.duration.standard } } },
  exit: { opacity: 0, y: y / 2, scale: 0.98, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: reduced ? 0 : motionTokens.duration.exit, ease: cubic(motionTokens.ease.standard) } },
});

export type FolderEvents = {
  onQuery?: (query: string, results: number) => void;
  onCopy?: (item: StashItem) => void;
  onOpen?: (query: string) => void;
  onHide?: () => void;
  onHover?: () => void;
  onDragging?: (dragging: boolean) => void;
};

function SearchWindow({ onHeld, close, events, library: editedLibrary }: { onHeld: (held: boolean) => void; close: () => void; events: FolderEvents; library?: StashItem[] }) {
  const { copy, language } = useSite();
  const reduced = useReducedMotion();
  const source = useMemo(() => demoLibrary(language), [language]);
  const library = editedLibrary ?? source;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StashItem[]>([]);
  const [focused, setFocused] = useState(false), [dragging, setDragging] = useState(false);
  const [index, setIndex] = useState(0), [copiedId, setCopiedId] = useState('');
  const [holdFrame, setHoldFrame] = useState(false), [settledQuery, setSettledQuery] = useState('');
  const pos = useMotionValue(0);
  const target = useRef(0), wheelDelta = useRef(0), hasResults = useRef(false), surface = useRef<HTMLDivElement>(null);
  const resultKey = results.map(item => item.id).join('|');
  hasResults.current = results.length > 0;
  useEffect(() => {
    const text = query.trim();
    if (!text) { setResults([]); return; }
    const timer = window.setTimeout(() => { setResults(matches(library, text).slice(0, RESULT_LIMIT)); setSettledQuery(text); }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [query, library]);
  useEffect(() => { events.onQuery?.(query, results.length); }, [query, results.length, events]);
  useLayoutEffect(() => { target.current = 0; pos.jump(0); setIndex(0); }, [resultKey, pos]);
  useLayoutEffect(() => { if (results.length) setHoldFrame(true); }, [results.length]);
  useEffect(() => onHeld(focused || dragging || Boolean(query.trim())), [focused, dragging, query, onHeld]);
  useEffect(() => { if (!copiedId) return; const timer = window.setTimeout(() => setCopiedId(''), COPIED_MS); return () => window.clearTimeout(timer); }, [copiedId]);
  const filled = results.length > 0 || holdFrame;
  const empty = Boolean(query.trim()) && !results.length && !holdFrame && settledQuery === query.trim();
  const go = (next: number) => {
    if (!results.length) return;
    const bounded = results.length >= 3 ? next : clamp(next, 0, results.length - 1);
    target.current = bounded; setIndex(bounded);
    if (reduced) pos.jump(bounded); else animate(pos, bounded, motionTokens.spring.gentle);
  };
  const goRef = useRef(go); goRef.current = go;
  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!hasResults.current) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      wheelDelta.current += (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * unit;
      if (Math.abs(wheelDelta.current) >= 48) { const step = Math.sign(wheelDelta.current); wheelDelta.current = 0; goRef.current(target.current + step); }
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  const copyItem = async (item: StashItem) => {
    setCopiedId('');
    try { await navigator.clipboard.writeText(buildContext([item])); } catch { /* the page may not have clipboard access; the paste demo still knows */ }
    setCopiedId(item.id); events.onCopy?.(item);
  };
  const dragStart = (item: StashItem, event: DragEvent<HTMLElement>) => {
    Object.entries(referenceDragPayload([item])).forEach(([type, value]) => { if (value) event.dataTransfer.setData(type, value); });
    event.dataTransfer.setData(REFERENCE_TYPE, item.id);
    event.dataTransfer.effectAllowed = 'copy';
    setDragging(true); events.onDragging?.(true);
  };
  const anchor = WINDOW_W / 2;
  return <motion.div ref={surface} className="quick-window" variants={panelMotion(reduced)} initial="hidden" animate="shown" exit="gone" onPointerDown={event => event.stopPropagation()}>
    <motion.div className={styles.frame} style={{ left: anchor - FLOW / 2 }} variants={frameMotion(reduced)} data-filled={filled || undefined}>
      <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => { if (!hasResults.current) setHoldFrame(false); }}>
        {results.length > 0 && <motion.div key={resultKey} className={styles.swap} {...rise(reduced, 14)}>
          <Flow items={results} pos={pos} index={index} copiedId={copiedId} go={go} onCopy={item => void copyItem(item)} onOpen={() => events.onOpen?.(query.trim())}
            onDragStart={dragStart} onDragEnd={() => { setDragging(false); events.onDragging?.(false); }} />
        </motion.div>}
      </AnimatePresence>
    </motion.div>
    <motion.div className={styles.field} style={{ left: anchor - FIELD / 2 }} variants={fieldMotion(reduced)}>
      <SearchField label={copy.hero.searchLabel} placeholder={copy.hero.search} value={query} onValueChange={setQuery} autoComplete="off" spellCheck={false}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); go(target.current + 1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); go(target.current - 1); }
          if (event.key === 'Escape') { event.preventDefault(); setQuery(''); (event.target as HTMLInputElement).blur(); close(); }
        }} />
    </motion.div>
    {empty && <p className={styles.empty} style={{ left: anchor }} role="status">{copy.hero.empty}</p>}
  </motion.div>;
}

/** The folder, draggable inside `bounds`. Click opens the library; hover opens the search. */
export function DeskFolder({ bounds, events = {}, hidden = false, library }: { bounds: RefObject<HTMLElement | null>; events?: FolderEvents; hidden?: boolean; library?: StashItem[] }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const [moving, setMoving] = useState(false);
  const [raised, setRaised] = useState(false);
  const timer = useRef<number>(undefined), settle = useRef<number>(undefined), moved = useRef(false);
  const intent = (next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setOpen(next); if (next) events.onHover?.(); }, INTENT_MS);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(settle.current); }, []);
  const visible = (open || held) && !moving && !hidden;
  // The folder stays raised while the search is out, and lowers after it folds back.
  useEffect(() => {
    window.clearTimeout(settle.current);
    if (visible) setRaised(true); else settle.current = window.setTimeout(() => setRaised(false), 260);
  }, [visible]);
  return <motion.div className="desk-folder" drag dragConstraints={bounds} dragElastic={0.06} dragMomentum={false}
    style={{ width: FOLDER, height: FOLDER }}
    onDragStart={() => { moved.current = true; setMoving(true); setOpen(false); }} onDragEnd={() => setMoving(false)}
    onPointerDown={() => { moved.current = false; }}
    onPointerEnter={() => intent(true)} onPointerLeave={() => intent(false)}
    animate={hidden ? { opacity: 0, scale: .96 } : { opacity: 1, scale: 1 }} transition={{ duration: hidden ? .12 : .2 }}
    data-search-open={raised || undefined} aria-hidden={hidden || undefined}>
    <AnimatePresence>{visible && <SearchWindow key="search" library={library} onHeld={setHeld} close={() => { setHeld(false); setOpen(false); }} events={{ ...events, onOpen: query => { setHeld(false); setOpen(false); events.onOpen?.(query); } }} />}</AnimatePresence>
    <div className="desk-folder-surface">
      <button type="button" className="desk-folder-button" aria-label="Open StashDock" onClick={() => { if (!moved.current) events.onOpen?.(''); }}>
        <FolderArtwork />
      </button>
      {events.onHide && <button type="button" className={folderControls.close} aria-label="Hide StashDock" onPointerDown={event => event.stopPropagation()} onClick={() => events.onHide?.()}>
        <span className={folderControls.circle}><X size={10} strokeWidth={1.5} aria-hidden="true" /></span>
      </button>}
    </div>
  </motion.div>;
}

export const searchWindowSize = { width: WINDOW_W, height: WINDOW_H, overlap: OVERLAP };
