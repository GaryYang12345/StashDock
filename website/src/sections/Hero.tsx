import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import { FolderSearchCard } from '../../../src/components/FolderSearchCard';
import { SearchField } from '../../../src/components/arc/search-field/search-field';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { buildContext } from '../../../src/lib/context-format.mjs';
import type { StashItem } from '../../../src/types';
import { demoLibrary } from '../demo-data';
import { links } from '../copy';
import { useSite } from '../parts/useSite';
import './hero.css';

const INTENT_MS = 180;
const COPIED_MS = 1600;
const cubic = (value: readonly number[]) => value as [number, number, number, number];

export function matches(items: StashItem[], query: string) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items.filter(item => {
    const text = `${item.title} ${item.excerpt} ${item.tags.join(' ')} ${item.source}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function Hero() {
  const { copy } = useSite();
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const [dragging, setDragging] = useState(false);
  const timer = useRef<number>(undefined);
  const intent = (next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), INTENT_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const visible = (open || held) && !dragging;
  return <section className="hero" id="top">
    <div className="hero-copy page">
      <motion.h1 className="display display-xl hero-title" initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .9, ease: cubic(motionTokens.ease.enter) }}>
        {copy.hero.title.split('\n').map(line => <span key={line}>{line}</span>)}
      </motion.h1>
      <motion.p className="lede hero-lede" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .12, ease: cubic(motionTokens.ease.enter) }}>{copy.hero.body}</motion.p>
      <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .22, ease: cubic(motionTokens.ease.enter) }}>
        <a className="pill primary" href={links.desktop}>{copy.hero.primary}</a>
        <span className="pill quiet">{copy.hero.secondary}</span>
      </motion.div>
    </div>
    <div className="hero-stage" ref={stage}>
      <motion.div className="hero-folder" drag dragConstraints={stage} dragElastic={0.08} dragMomentum={false}
        initial={{ opacity: 0, y: 40, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, delay: .3, ease: cubic(motionTokens.ease.enter) }}
        whileDrag={{ scale: 1.03 }} onDragStart={() => { setDragging(true); setOpen(false); }} onDragEnd={() => setDragging(false)}
        onPointerEnter={() => intent(true)} onPointerLeave={() => intent(false)} data-open={visible || undefined}>
        <QuickSearch open={visible} onHeld={setHeld} />
        <div className="hero-folder-art" aria-label="StashDock folder" role="img"><FolderArtwork /></div>
      </motion.div>
      <p className="hero-hint small">{copy.hero.hint}</p>
    </div>
  </section>;
}

const fieldMotion = (reduced: boolean | null): Variants => ({
  hidden: { opacity: 0, y: 18, scaleX: .78, scaleY: .6, filter: `blur(${motionTokens.blur.soft}px)` },
  shown: { opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.standard } } },
  gone: { opacity: 0, y: 18, scaleX: .78, scaleY: .6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: cubic(motionTokens.ease.inOut), opacity: { duration: motionTokens.duration.fast, delay: .06 } } },
});

// The folder's quick entry, as on the desktop: a field floats out of the
// folder; typing shows a cover flow above it; only Copy copies.
function QuickSearch({ open, onHeld }: { open: boolean; onHeld: (held: boolean) => void }) {
  const { copy, language } = useSite();
  const reduced = useReducedMotion();
  const library = useMemo(() => demoLibrary(language), [language]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const [copiedId, setCopiedId] = useState('');
  const results = useMemo(() => matches(library, query).slice(0, 7), [library, query]);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => onHeld(focused || Boolean(query.trim())), [focused, query, onHeld]);
  useEffect(() => { if (!copiedId) return; const id = window.setTimeout(() => setCopiedId(''), COPIED_MS); return () => window.clearTimeout(id); }, [copiedId]);
  const go = (next: number) => setIndex(Math.max(0, Math.min(results.length - 1, next)));
  const copyItem = async (item: StashItem) => {
    try { await navigator.clipboard.writeText(buildContext([item])); } catch { /* The page may lack clipboard permission; the gesture still reads. */ }
    setCopiedId(item.id);
  };
  const empty = Boolean(query.trim()) && !results.length;
  return <AnimatePresence>{open && <motion.div className="quick" initial="hidden" animate="shown" exit="gone" variants={{ hidden: {}, shown: {}, gone: { transition: { staggerChildren: reduced ? 0 : .07 } } }}
    onPointerDown={event => event.stopPropagation()}>
    <motion.div className="quick-flow" variants={{ hidden: {}, shown: {}, gone: { opacity: 0, y: 22, scale: .94, transition: { duration: reduced ? 0 : motionTokens.duration.exit } } }}
      onWheel={event => { if (results.length > 1) go(index + (event.deltaY > 0 ? 1 : -1)); }}>
      <AnimatePresence initial={false} mode="popLayout">
        {results.length > 0 && <motion.div key={results.map(item => item.id).join()} className="quick-stage"
          initial={{ opacity: 0, y: 14, scale: .96, filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 7, scale: .98, transition: { duration: motionTokens.duration.exit } }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
          {results.map((item, i) => {
            const offset = i - index, distance = Math.abs(offset);
            return <motion.div key={item.id} className="quick-slot" style={{ zIndex: 10 - distance }}
              animate={{ x: offset * 132, scale: distance ? .86 : 1, opacity: distance > 2 ? 0 : distance ? .75 : 1, rotateY: offset * -14 }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
              <FolderSearchCard item={item} current={!distance} copied={copiedId === item.id} onCopy={() => void copyItem(item)}
                onActivate={() => go(i)} onDragStart={event => event.dataTransfer.setData('text/plain', buildContext([item]))} onDragEnd={() => {}} />
            </motion.div>;
          })}
        </motion.div>}
      </AnimatePresence>
      {empty && <p className="quick-empty" role="status">{copy.hero.empty}</p>}
    </motion.div>
    <motion.div className="quick-field" variants={fieldMotion(reduced)}>
      <SearchField label={copy.hero.search} placeholder={copy.hero.search} value={query} onValueChange={setQuery} autoComplete="off" spellCheck={false}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); go(index + 1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); go(index - 1); }
          if (event.key === 'Escape') { setQuery(''); (event.target as HTMLInputElement).blur(); }
        }} />
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
