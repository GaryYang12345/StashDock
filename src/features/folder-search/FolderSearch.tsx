import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue, type TargetAndTransition, type Variants } from 'motion/react';
import { SearchField } from '../../components/arc/search-field/search-field';
import { motionTokens } from '../../components/arc/lib/motion-tokens';
import { FolderSearchCard } from '../../components/FolderSearchCard';
import { copyContext } from '../../lib/context';
import { endReferenceDrag, startReferenceDrag } from '../../lib/reference-drag';
import { getItems, searchItems } from '../../lib/storage';
import { useI18n } from '../settings/locale';
import type { StashItem } from '../../types';
import styles from './FolderSearch.module.css';

// The folder's quick search: a field that rises out of the folder, then a
// cover flow of matching references above it. Everything floats; nothing is
// wrapped in a panel. Native placement, hover intent and focus belong to
// folder_search.rs; this view only reports what it shows and what the user does.
type Status = { open: boolean; upward: boolean; anchorPx: number | null };
const FIELD = 184, FLOW = 460, CARD = 232;
/** Room around the field for its shadow, inside the window region. */
const FIELD_SHADOW = 32;
const RESULT_LIMIT = 24;
const SEARCH_DELAY = 140;
const COPIED_MS = 1800;
/** A native drag ends with no pointer events; the pointer is then treated as gone. */
const POINTER_RESET = 'folder-search-pointer-reset';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mod = (value: number, size: number) => ((value % size) + size) % size;
const cubic = (ease: readonly number[]) => [...ease] as [number, number, number, number];

// Cover flow: side cards tuck behind the current one, turned towards it, and
// both ends dissolve. d is a card's continuous distance from the centre.
function place(d: number) {
  const a = Math.abs(d), s = Math.sign(d);
  const x = s * (a <= 1 ? a * CARD * 0.54 : CARD * 0.54 + (a - 1) * CARD * 0.22);
  const opacity = a <= 1 ? 1 - a * 0.5 : Math.max(0, 0.5 - (a - 1) * 0.85);
  return { transform: `translateX(${x}px) translateZ(${-Math.min(a, 1) * 150 - Math.max(0, a - 1) * 80}px) rotateY(${-clamp(d, -1, 1) * 48}deg)`, opacity, z: 100 - Math.round(a * 10) };
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

// Opening: the field rises out of the folder, then cards rise out of the field.
// Closing runs the same path backwards: cards sink into the field, then the
// field folds back into the folder. Mirrored when it opens below.
const panelMotion = (reduced: boolean | null): Variants => ({ hidden: {}, shown: {}, gone: { transition: { staggerChildren: reduced ? 0 : 0.07 } } });
const fieldMotion = (reduced: boolean | null, upward: boolean): Variants => {
  const y = upward ? 18 : -18;
  return {
    hidden: { opacity: 0, y, scaleX: 0.78, scaleY: 0.6, filter: `blur(${motionTokens.blur.soft}px)` },
    shown: { opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: cubic(motionTokens.ease.enter) }, filter: { duration: motionTokens.duration.standard } } },
    gone: { opacity: 0, y, scaleX: 0.78, scaleY: 0.6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: cubic(motionTokens.ease.inOut), opacity: { duration: motionTokens.duration.fast, delay: 0.06 } } },
  };
};
const frameMotion = (reduced: boolean | null, upward: boolean): Variants => ({
  hidden: {}, shown: { opacity: 1, y: 0, scale: 1 },
  gone: { opacity: 0, y: upward ? 22 : -22, scale: 0.94, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: reduced ? 0 : motionTokens.duration.exit, ease: cubic(motionTokens.ease.standard) } },
});
const rise = (reduced: boolean | null, y: number): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } => ({
  initial: { opacity: 0, y, scale: 0.96, filter: `blur(${motionTokens.blur.soft}px)` },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: cubic(motionTokens.ease.enter) }, filter: { duration: motionTokens.duration.standard } } },
  exit: { opacity: 0, y: y / 2, scale: 0.98, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: reduced ? 0 : motionTokens.duration.exit, ease: cubic(motionTokens.ease.standard) } },
});

function SearchPanel({ status, onHeld }: { status: Status; onHeld: (held: boolean) => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StashItem[]>([]);
  const [focused, setFocused] = useState(false), [dragging, setDragging] = useState(false);
  const [index, setIndex] = useState(0), [copiedId, setCopiedId] = useState('');
  const [holdFrame, setHoldFrame] = useState(false), [settledQuery, setSettledQuery] = useState('');
  const pos = useMotionValue(0);
  const target = useRef(0), wheelDelta = useRef(0), request = useRef(0), hasResults = useRef(false);
  const surface = useRef<HTMLDivElement>(null), field = useRef<HTMLDivElement>(null), frame = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), note = useRef<HTMLParagraphElement>(null);
  const resultKey = results.map(item => item.id).join('|');
  hasResults.current = results.length > 0;

  // One answer per query: results change once, when the index has answered.
  useEffect(() => {
    const text = query.trim(), id = ++request.current;
    if (!text) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      void searchItems(text, []).then(ids => ids.length ? getItems(ids.slice(0, RESULT_LIMIT)) : [])
        .then(items => { if (id === request.current) { setResults(items); setSettledQuery(text); } })
        .catch(() => { if (id === request.current) { setResults([]); setSettledQuery(text); } });
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);
  useLayoutEffect(() => { target.current = 0; pos.jump(0); setIndex(0); }, [resultKey, pos]);
  useLayoutEffect(() => { if (results.length) setHoldFrame(true); }, [results.length]);
  useEffect(() => onHeld(focused || dragging || Boolean(query.trim())), [focused, dragging, query, onHeld]);
  useEffect(() => { if (!copiedId) return; const timer = window.setTimeout(() => setCopiedId(''), COPIED_MS); return () => window.clearTimeout(timer); }, [copiedId]);

  // Only what is visible takes input: the field, and the cards while shown.
  const filled = results.length > 0 || holdFrame;
  const empty = Boolean(query.trim()) && !results.length && !holdFrame && settledQuery === query.trim();
  useLayoutEffect(() => {
    const rects = [];
    // Layout boxes, not animated ones: the region covers where things settle.
    if (field.current) { const { offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h } = field.current; rects.push({ x: x - FIELD_SHADOW, y: y - FIELD_SHADOW, width: w + FIELD_SHADOW * 2, height: h + FIELD_SHADOW * 2 }); }
    if (filled && frame.current) { const { offsetTop: y, offsetHeight: h } = frame.current; rects.push({ x: 0, y: y - 40, width: window.innerWidth, height: h + 64 }); }
    if (empty && note.current) { const box = note.current.getBoundingClientRect(); rects.push({ x: box.left - 8, y: box.top - 8, width: box.width + 16, height: box.height + 16 }); }
    void invoke('folder_search_region', { rects }).catch(() => {});
  }, [filled, empty, status.upward, status.anchorPx]);

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
    // Vertical wheel turns the flow; one notch (or ~48px of trackpad travel) is one card.
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

  const copy = useCallback(async (item: StashItem) => {
    setCopiedId('');
    try { await copyContext([item]); setCopiedId(item.id); } catch { /* the button returns to Copy */ }
  }, []);
  const open = (item: StashItem | null) => { void invoke('folder_search_open_library', { query: query.trim() || item?.title || '' }).catch(() => {}); };
  const dragStart = (item: StashItem, event: DragEvent<HTMLElement>) => {
    const card = event.currentTarget;
    startReferenceDrag(event, [item]);
    if (!card.dataset.dragging) return;
    // Hold the search open for the whole native drag (its modal loop delivers no
    // pointer events), and treat the pointer as gone once it ends.
    setDragging(true);
    const watcher = new MutationObserver(() => { if (!card.dataset.dragging) { watcher.disconnect(); setDragging(false); window.dispatchEvent(new Event(POINTER_RESET)); } });
    watcher.observe(card, { attributes: true, attributeFilter: ['data-dragging'] });
  };
  // Centre the field and the cards on the folder (the window is only offset
  // from it at a screen edge), in this page's own CSS pixels.
  const width = window.innerWidth;
  const anchor = status.anchorPx == null ? width / 2 : status.anchorPx / window.devicePixelRatio;
  const fieldCentre = clamp(anchor, FIELD / 2, width - FIELD / 2);
  const fieldLeft = fieldCentre - FIELD / 2;
  const flowLeft = clamp(anchor, FLOW / 2, width - FLOW / 2) - FLOW / 2;
  return <motion.div ref={surface} className={styles.surface} data-upward={status.upward || undefined} variants={panelMotion(reduced)} initial="hidden" animate="shown" exit="gone">
    {/* Keeps its size until leaving cards have sunk into the field, so they never flash past it. */}
    <motion.div ref={frame} className={styles.frame} style={{ left: flowLeft }} variants={frameMotion(reduced, status.upward)}
      data-filled={filled || undefined}>
      <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => { if (!hasResults.current) setHoldFrame(false); }}>
        {results.length > 0 && <motion.div key={resultKey} className={styles.swap} {...rise(reduced, status.upward ? 14 : -14)}>
          <Flow items={results} pos={pos} index={index} copiedId={copiedId} go={go} onCopy={item => void copy(item)} onOpen={open}
            onDragStart={dragStart} onDragEnd={endReferenceDrag} />
        </motion.div>}
      </AnimatePresence>
    </motion.div>
    <motion.div ref={field} className={styles.field} style={{ left: fieldLeft }} variants={fieldMotion(reduced, status.upward)}
      onPointerDown={() => { if (!focused) void invoke('folder_search_focus').then(() => input.current?.focus()).catch(() => {}); }}>
      <SearchField ref={input} label={t('Search references')} placeholder={t('Search')} value={query} onValueChange={setQuery} autoComplete="off" spellCheck={false}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={event => {
          // Up/Down turn the flow so Left/Right keep moving the caret. Only Copy copies.
          if (event.key === 'ArrowDown') { event.preventDefault(); go(target.current + 1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); go(target.current - 1); }
          if (event.key === 'Escape') { event.preventDefault(); void invoke('folder_search_close').catch(() => {}); }
        }} />
    </motion.div>
    {empty && <p ref={note} className={styles.empty} style={{ left: fieldCentre }} role="status">{t('No matching references')}</p>}
  </motion.div>;
}

export function FolderSearch() {
  const [status, setStatus] = useState<Status>({ open: false, upward: true, anchorPx: null });
  // Each opening is a fresh search: a new query, no leftover cards.
  const [session, setSession] = useState(0);
  useEffect(() => {
    let stopped = false, cleanup: (() => void) | undefined;
    void listen<Status>('folder-search-state', event => { if (!stopped) setStatus(event.payload); }).then(stop => { if (stopped) stop(); else cleanup = stop; });
    void invoke<Status>('folder_search_status').then(value => { if (!stopped) setStatus(value); }).catch(() => {});
    return () => { stopped = true; cleanup?.(); };
  }, []);
  useEffect(() => {
    // Pointer hover is reported per window; the native side combines it with
    // the folder's and applies one intent delay both ways.
    let inside = false;
    const report = (next: boolean) => { if (inside === next) return; inside = next; void invoke('folder_search_pointer', { inside: next }).catch(() => {}); };
    const over = () => report(true), out = (event: PointerEvent) => { if (!event.relatedTarget) report(false); };
    const reset = () => { inside = true; report(false); };
    document.addEventListener('pointerover', over); document.addEventListener('pointermove', over); document.addEventListener('pointerout', out);
    window.addEventListener(POINTER_RESET, reset);
    return () => { document.removeEventListener('pointerover', over); document.removeEventListener('pointermove', over); document.removeEventListener('pointerout', out); window.removeEventListener(POINTER_RESET, reset); };
  }, []);
  // A closed search has no hover; the next pointer movement over it reports again.
  useEffect(() => { if (!status.open) window.dispatchEvent(new Event(POINTER_RESET)); }, [status.open]);
  const held = useRef(false);
  const onHeld = useCallback((next: boolean) => { if (held.current === next) return; held.current = next; void invoke('folder_search_hold', { held: next }).catch(() => {}); }, []);
  return <AnimatePresence onExitComplete={() => { held.current = false; setSession(value => value + 1); void invoke('folder_search_closed').catch(() => {}); }}>
    {status.open && <SearchPanel key={session} status={status} onHeld={onHeld} />}
  </AnimatePresence>;
}

