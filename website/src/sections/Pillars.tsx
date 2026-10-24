import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { Input } from '../../../src/components/arc/input/input';
import { CopyForAI } from '../../../src/components/CopyForAI';
import { PreviewArtwork } from '../../../src/components/StashCard';
import { ReferenceMark } from '../../../src/components/SiteIdentity';
import { ReferenceGlyph } from '../../../src/components/ReferenceVisual';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import action from '../../../src/components/CopyForAI.module.css';
import brandMark from '../../../assets/brand/icon.svg';
import type { StashItem } from '../../../src/types';
import { demoLibrary } from '../demo-data';
import { Reveal } from '../parts/Reveal';
import { useInView, useSite } from '../parts/useSite';
import './pillars.css';

const spring = motionTokens.spring.smooth;
const strip = ({ url: _url, assetPath: _asset, hasFile: _file, ...item }: StashItem): StashItem => item;

export function Pillars() {
  const { copy } = useSite();
  return <section className="section pillars" id="features" aria-label={copy.nav.features}>
    <Pillar title={copy.collect.title} body={copy.collect.body}><CollectVisual /></Pillar>
    <Pillar title={copy.find.title} body={copy.find.body} flip><FindVisual /></Pillar>
    <Pillar title={copy.use.title} body={copy.use.body}><UseVisual /></Pillar>
    <Pillar id="agents" title={copy.agents.title} body={copy.agents.body} flip><AgentsVisual /></Pillar>
  </section>;
}

function Pillar({ id, title, body, flip, children }: { id?: string; title: string; body: string; flip?: boolean; children: ReactNode }) {
  return <article className="pillar page" id={id} data-flip={flip || undefined}>
    <Reveal className="pillar-copy">
      <h2 className="display display-md">{title}</h2>
      <p className="lede">{body}</p>
    </Reveal>
    <Reveal className="pillar-stage" delay={100}>{children}</Reveal>
  </article>;
}

/* Collect: the browser extension's Save page sidebar beside the page being read. */
function CollectVisual() {
  const { copy, language } = useSite();
  const text = copy.collect;
  const tags = useMemo(() => language === 'zh' ? ['设计', '写作', '调研'] : ['Design', 'Writing', 'Research'], [language]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [title, setTitle] = useState(text.page);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => { setTitle(text.page); setChosen([tags[0]]); }, [text.page, tags]);
  useEffect(() => {
    if (phase === 'idle') return;
    const id = window.setTimeout(() => setPhase(phase === 'saving' ? 'saved' : 'idle'), phase === 'saving' ? 520 : 1800);
    return () => window.clearTimeout(id);
  }, [phase]);
  return <div className="collect">
    <div className="browser">
      <div className="browser-bar"><span className="browser-dots"><i /><i /><i /></span><span className="browser-address">{text.pageSite}/calm-interfaces</span></div>
      <div className="browser-page" aria-hidden="true">
        <span className="sketch-kicker" />
        <p className="display browser-headline">{text.page}</p>
        <p className="browser-body">{text.pageBody}</p>
        <span className="sketch-line" /><span className="sketch-line short" /><span className="sketch-line" />
        <span className="sketch-figure" />
      </div>
    </div>
    <aside className="sidebar" aria-label={text.extension}>
      <header className="sidebar-head"><img src={brandMark} alt="" width={20} height={20} /><span>{text.extension}</span></header>
      <Input label={text.titleLabel} value={title} onChange={event => setTitle(event.target.value)} />
      <div className="sidebar-field">
        <span className="sidebar-label">{text.tagsLabel}</span>
        <div className="sidebar-tags">{tags.map(tag => <Button key={tag} type="button" size="sm" variant={chosen.includes(tag) ? 'primary' : 'secondary'} aria-pressed={chosen.includes(tag)}
          onClick={() => setChosen(current => current.includes(tag) ? current.filter(name => name !== tag) : [...current, tag])}>{tag}</Button>)}</div>
      </div>
      <Button type="button" variant="primary" className={`sidebar-save ${phase === 'saved' ? action.success : ''}`} loading={phase === 'saving'} disabled={!title.trim()}
        onClick={() => { if (phase === 'idle') setPhase('saving'); }}>
        {phase === 'saved' && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}{phase === 'saved' ? text.saved : text.save}
      </Button>
    </aside>
  </div>;
}

/* Find: tags are context groups; choosing one regroups the cards in place. */
function FindVisual() {
  const { copy, language } = useSite();
  const reduced = useReducedMotion();
  const library = useMemo(() => demoLibrary(language), [language]);
  // The groups with the most to show.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    library.forEach(item => item.tags.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name);
  }, [library]);
  const [tag, setTag] = useState('');
  const [touched, setTouched] = useState(false);
  const [ref, shown] = useInView<HTMLDivElement>('-25% 0px');
  // Until someone chooses a tag, the visual shows how tags regroup the library.
  useEffect(() => {
    if (!shown || touched || reduced) return;
    const cycle = ['', ...tags];
    let index = 0;
    const id = window.setInterval(() => { index = (index + 1) % cycle.length; setTag(cycle[index]); }, 2400);
    return () => window.clearInterval(id);
  }, [shown, touched, reduced, tags]);
  const items = library.filter(item => !tag || item.tags.includes(tag));
  return <div className="find" ref={ref}>
    <div className="find-tags" role="group" aria-label={copy.collect.tagsLabel}>
      {['', ...tags].map(name => <Button key={name || 'all'} type="button" size="sm" variant={tag === name ? 'primary' : 'secondary'} aria-pressed={tag === name}
        onClick={() => { setTouched(true); setTag(name); }}>{name || copy.demo.allTags}</Button>)}
    </div>
    <LayoutGroup>
      <motion.div className="find-grid" layout={!reduced}>
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map(item => <motion.div key={item.id} className="mini-card" layout={!reduced} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} transition={reduced ? { duration: 0 } : spring}>
            <div className="mini-cover"><PreviewArtwork item={strip(item)} /></div>
            <div className="mini-row"><ReferenceMark item={strip(item)} /><span>{item.title}</span></div>
          </motion.div>)}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  </div>;
}

/* Use: a reference travels into an AI window and arrives as the original file plus its context. */
function UseVisual() {
  const { copy, language } = useSite();
  const reduced = useReducedMotion();
  const item = useMemo(() => demoLibrary(language).find(entry => entry.id === 'spec')!, [language]);
  const base = item.title.replace(/\.pdf$/i, '');
  const stage = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const [ref, shown] = useInView<HTMLDivElement>('-30% 0px');
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'travel' | 'arrived'>('idle');
  const [path, setPath] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (shown) setRun(1); }, [shown]);
  useLayoutEffect(() => {
    if (!run) return;
    const box = stage.current?.getBoundingClientRect(), a = source.current?.getBoundingClientRect(), b = target.current?.getBoundingClientRect();
    if (!box || !a || !b) return;
    setPath({ from: { x: a.left - box.left, y: a.top - box.top }, to: { x: b.left - box.left + 12, y: b.top - box.top + 8 } });
    setPhase(reduced ? 'arrived' : 'travel');
  }, [run, reduced]);
  useEffect(() => {
    if (phase !== 'travel') return;
    const id = window.setTimeout(() => setPhase('arrived'), 1350);
    return () => window.clearTimeout(id);
  }, [phase]);
  useEffect(() => { if (!copied) return; const id = window.setTimeout(() => setCopied(false), 1400); return () => window.clearTimeout(id); }, [copied]);
  const replay = () => { setPhase('idle'); setPath(null); window.requestAnimationFrame(() => setRun(value => value + 1)); };
  const paste = () => { setCopied(true); setPhase('idle'); window.setTimeout(() => setPhase('arrived'), 380); };
  return <div className="use" ref={node => { stage.current = node; (ref as { current: HTMLDivElement | null }).current = node; }}>
    <div className="use-source" ref={source}>
      <div className="mini-card use-card" data-lifted={phase === 'travel' || undefined}>
        <div className="mini-cover"><PreviewArtwork item={strip(item)} /></div>
        <div className="mini-row"><ReferenceMark item={strip(item)} /><span>{item.title}</span></div>
      </div>
      <CopyForAI copied={copied} onCopy={paste} label={item.title} />
    </div>
    <div className="use-app">
      <div className="use-app-head"><span>{copy.demo.chatTitle}</span></div>
      <div className="use-app-body" />
      <div className="use-composer" ref={target} data-arrived={phase === 'arrived' || undefined}>
        <AnimatePresence>{phase === 'arrived' && <motion.div className="use-attachments" initial="hidden" animate="shown" exit="hidden" variants={{ shown: { transition: { staggerChildren: .08 } } }}>
          {[{ kind: 'pdf' as const, name: item.title, meta: 'PDF' }, { kind: 'markdown' as const, name: `${base}.md`, meta: language === 'zh' ? '上下文' : 'Context' }].map(file =>
            <motion.span key={file.name} className="attachment" variants={{ hidden: { opacity: 0, y: 8, scale: .94 }, shown: { opacity: 1, y: 0, scale: 1, transition: spring } }}>
              <ReferenceGlyph kind={file.kind} size={26} /><span><b>{file.name}</b><small>{file.meta}</small></span>
            </motion.span>)}
        </motion.div>}</AnimatePresence>
        <p className="use-message" data-shown={phase === 'arrived' || undefined}>{copy.use.message}</p>
      </div>
    </div>
    <AnimatePresence>{phase === 'travel' && path && <motion.div key={run} className="mini-card use-ghost" aria-hidden="true"
      initial={{ x: path.from.x, y: path.from.y, scale: 1, rotate: 0, opacity: .96 }}
      animate={{ x: [path.from.x, (path.from.x + path.to.x) / 2, path.to.x], y: [path.from.y, Math.min(path.from.y, path.to.y) - 40, path.to.y], scale: [1, .92, .5], rotate: [0, -3, 0], opacity: [.96, .96, 0] }}
      transition={{ duration: 1.3, times: [0, .55, 1], ease: [.45, 0, .2, 1] }}>
      <div className="mini-cover"><PreviewArtwork item={strip(item)} /></div>
      <div className="mini-row"><ReferenceMark item={strip(item)} /><span>{item.title}</span></div>
    </motion.div>}</AnimatePresence>
    <Button type="button" variant="ghost" size="sm" className="stage-replay" onClick={replay}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />{copy.use.replay}</Button>
  </div>;
}

/* Agents: an AI saves a rule through MCP, and another conversation finds it later. */
function AgentsVisual() {
  const { copy, language } = useSite();
  const text = copy.agents;
  const reduced = useReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>('-30% 0px');
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const rule = useMemo(() => demoLibrary(language).find(item => item.id === 'rules')!, [language]);
  const steps = 7;
  useEffect(() => { if (shown && !run) setRun(1); }, [shown, run]);
  useEffect(() => {
    if (!run) return;
    if (reduced) { setStep(steps); return; }
    setStep(0);
    const delays = [300, 1100, 1900, 3000, 3700, 4500, 5300];
    const ids = delays.map((delay, i) => window.setTimeout(() => setStep(i + 1), delay));
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [run, reduced]);
  const appear = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: reduced ? { duration: 0 } : spring };
  return <div className="agents" ref={ref}>
    <div className="agents-chat" aria-live="polite">
      {step >= 1 && <motion.p className="agent-bubble user" {...appear}>{text.user1}</motion.p>}
      {step >= 2 && <motion.div className="agent-tool" {...appear}><img src={brandMark} alt="" width={18} height={18} /><span>{text.tool}</span><Check size={14} strokeWidth={2} aria-hidden="true" /></motion.div>}
      {step >= 3 && <motion.p className="agent-bubble ai" {...appear}>{text.agent1}</motion.p>}
      {step >= 4 && <motion.div className="agent-later" {...appear}><span>{text.later}</span></motion.div>}
      {step >= 5 && <motion.p className="agent-bubble user" {...appear}>{text.user2}</motion.p>}
      {step >= 6 && <motion.div className="agent-tool" {...appear}><img src={brandMark} alt="" width={18} height={18} /><span>{text.tool2}</span><Check size={14} strokeWidth={2} aria-hidden="true" /></motion.div>}
      {step >= 7 && <motion.p className="agent-bubble ai" {...appear}>{text.agent2}</motion.p>}
    </div>
    <div className="agents-library" aria-hidden="true">
      <span className="agents-library-label">StashDock</span>
      <AnimatePresence>{step >= 2 && <motion.div className="agents-note" data-reused={step >= 6 || undefined} initial={{ opacity: 0, y: -12, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={reduced ? { duration: 0 } : { ...spring, delay: .2 }}>
        <ReferenceGlyph kind="note" size={22} />
        <b>{rule.title}</b>
        <small>{rule.excerpt}</small>
        <span className="agents-tag">{rule.tags[0]}</span>
      </motion.div>}</AnimatePresence>
      <span className="agents-ghost" /><span className="agents-ghost" />
    </div>
    <Button type="button" variant="ghost" size="sm" className="stage-replay" onClick={() => setRun(value => value + 1)} disabled={step < steps}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />{text.replay}</Button>
  </div>;
}
