import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Check, Download, FileUp, Link, Plus, RefreshCw, RotateCcw, SquarePen, X } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { Input } from '../../../src/components/arc/input/input';
import { Checkbox } from '../../../src/components/arc/checkbox/checkbox';
import { Skeleton } from '../../../src/components/arc/skeleton/skeleton';
import { ReferenceCardView } from '../../../src/components/StashCard';
import { ReferenceGlyph } from '../../../src/components/ReferenceVisual';
import { SiteFavicon } from '../../../src/components/SiteIdentity';
import { BrandIcon } from '../../../src/components/BrandIcon';
import { ImportProgress } from '../../../src/components/ImportProgress';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { renderPopup, type PopupServices } from '../../../src/features/browser-extension/Popup';
import { useI18n } from '../../../src/features/settings/locale';
import header from '../../../src/components/DockHeader.module.css';
import importStyles from '../../../src/components/DesktopImportDialog.module.css';
import dialog from '../../../src/components/FluidDialog.module.css';
import menu from '../../../src/components/arc/dropdown-menu/dropdown-menu.module.css';
import shelf from '../../../src/features/mcp-app/McpShelf.module.css';
import brandMark from '../../../assets/brand/icon.svg';
import chromeMark from '../../../src/assets/brands/chrome.svg';
import edgeMark from '../../../src/assets/brands/edge.svg';
import firefoxMark from '../../../src/assets/brands/firefox.svg';
import safariMark from '../../../src/assets/brands/safari.svg';
import type { StashItem } from '../../../src/types';
import { demoLibrary } from '../demo-data';
import { Cursor, useScript } from '../parts/Cursor';
import { Reveal } from '../parts/Reveal';
import { useInView, useSite } from '../parts/useSite';
import { shown } from './LiveDemo';
import './pillars.css';

const spring = motionTokens.spring.smooth;

export function Pillars() {
  const { copy } = useSite();
  return <section className="section pillars" id="features" aria-label={copy.nav.features}>
    <Pillar id="import" title={copy.importing.title} body={copy.importing.body}><ImportVisual /></Pillar>
    <Pillar title={copy.saving.title} body={copy.saving.body} flip extra={<BrowserMarks />}><SaveVisual /></Pillar>
    <Pillar id="agents" title={copy.agents.title} body={copy.agents.body}><AgentsVisual /></Pillar>
  </section>;
}

function Pillar({ id, title, body, flip, extra, children }: { id?: string; title: string; body: string; flip?: boolean; extra?: ReactNode; children: ReactNode }) {
  return <article className="pillar page" id={id} data-flip={flip || undefined}>
    <Reveal className="pillar-copy">
      <h2 className="display display-md">{title}</h2>
      <p className="lede">{body}</p>
      {extra}
    </Reveal>
    <Reveal className="pillar-stage" delay={100}>{children}</Reveal>
  </article>;
}

function BrowserMarks() {
  const { copy } = useSite();
  return <div className="browser-marks">
    <span>{[chromeMark, edgeMark, firefoxMark, safariMark].map(mark => <img key={mark} src={mark} alt="" width={28} height={28} />)}</span>
    <p className="small">{copy.saving.browsers}</p>
  </div>;
}

/* Plays once when it scrolls into view, then again on Replay. */
function useAutoplay(play: () => void, margin = '-25% 0px') {
  const [ref, inView] = useInView<HTMLDivElement>(margin);
  const [run, setRun] = useState(0);
  useEffect(() => { if (inView) setRun(1); }, [inView]);
  const playRef = useRef(play); playRef.current = play;
  useEffect(() => { if (run) playRef.current(); }, [run]);
  return { ref, replay: () => setRun(value => value + 1), started: run > 0 };
}

/* Import: the panel's Import references, Import from Chrome, the bookmarks
   chosen, the shared progress, then the new cards in the library. */
type ImportPhase = 'idle' | 'dialog' | 'menu' | 'reading' | 'list' | 'progress' | 'done';
function ImportVisual() {
  const { copy, language } = useSite();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement | null>(null);
  const script = useScript(stage);
  const library = useMemo(() => demoLibrary(language), [language]);
  const existing = useMemo(() => library.filter(item => ['spec', 'rules'].includes(item.id)), [library]);
  const imported = useMemo(() => ['calm', 'sdk', 'reuse', 'pricing-thread', 'voice'].map(id => library.find(item => item.id === id)!), [library]);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [completed, setCompleted] = useState(0);
  const [pressed, setPressed] = useState('');
  const auto = useAutoplay(() => void play());
  async function play() {
    const s = script.start();
    setPhase('idle'); setCompleted(0); setPressed('');
    s.place(stage.current ? stage.current.clientWidth - 60 : 400, stage.current ? stage.current.clientHeight - 40 : 400);
    const click = async (selector: string, next: () => void, travel = 750) => {
      if (!await s.move(selector, travel)) return false;
      setPressed(selector); if (!await s.press()) return false; setPressed('');
      next(); return s.wait(reduced ? 0 : 420);
    };
    if (!await s.wait(400)) return;
    if (!await click('[data-step="import"]', () => setPhase('dialog'))) return;
    if (!await click('[data-step="from"]', () => setPhase('menu'))) return;
    if (!await click('[data-step="chrome"]', () => setPhase('reading'))) return;
    if (!await s.wait(800)) return;
    setPhase('list');
    if (!await s.wait(700)) return;
    if (!await click('[data-step="submit"]', () => setPhase('progress'))) return;
    for (let i = 1; i <= imported.length; i++) { if (!await s.wait(260)) return; setCompleted(i); }
    if (!await s.wait(900)) return;
    setPhase('done');
    await s.move('[data-step="grid"]', 900, .5, .3);
  }
  const cards = phase === 'done' ? [...imported, ...existing] : existing;
  const open = phase !== 'idle' && phase !== 'done';
  return <div className="import" ref={node => { stage.current = node; (auto.ref as { current: HTMLDivElement | null }).current = node; }}>
    <div className="import-panel">
      <main data-arc-ui className={`${shelf.root} import-shelf`}>
        <header className={header.header}>
          <div className={header.top}><BrandIcon className={shelf.brand} />
            <Button variant="secondary" size="sm" data-step="import" data-pressed={pressed === '[data-step="import"]' || undefined} tabIndex={-1}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import references')}</Button>
          </div>
        </header>
        <div className="import-grid" data-step="grid">
          <AnimatePresence initial={false} mode="popLayout">
            {cards.map((item, i) => <motion.div key={item.id} layout={!reduced} initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring, delay: phase === 'done' ? i * .06 : 0 } }}>
              <ReferenceCardView item={shown(item)} view="grid" selected={false} selectable={false} action={null} onToggle={() => {}} onFavorite={() => {}} onDelete={() => {}} onOpen={() => {}} />
            </motion.div>)}
          </AnimatePresence>
        </div>
      </main>
      <AnimatePresence>{open && <motion.div key="overlay" className="import-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} />}</AnimatePresence>
      <AnimatePresence>{open && <motion.div key="dialog" className="import-dialog" data-progress={phase === 'progress' || undefined} layout={!reduced}
        initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98, transition: { duration: .18 } }} transition={reduced ? { duration: 0 } : spring}>
        {phase === 'progress' ? <div className="import-progress"><ImportProgress completed={completed} total={imported.length} /></div> : <>
          <div className={dialog.header}><h3 className={dialog.title}>{t('Import references')}</h3><Button variant="ghost" size="sm" className={dialog.close} tabIndex={-1} aria-label={t('Close')}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button></div>
          <div className={dialog.body}>
            {phase === 'dialog' || phase === 'menu' ? <div className={importStyles.importTabs}>
              <div className={importStyles.typeBar}>
                <div className="import-tabs" role="presentation">
                  <span data-active><Link size={16} strokeWidth={1.75} aria-hidden="true" />{t('Link')}</span>
                  <span><SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />{t('Note')}</span>
                  <span><FileUp size={16} strokeWidth={1.75} aria-hidden="true" />{t('File')}</span>
                </div>
                <div className="import-from">
                  <Button variant="secondary" size="sm" data-step="from" tabIndex={-1}><Download size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import from')}</Button>
                  <AnimatePresence>{phase === 'menu' && <motion.div className={`${menu.menu} import-menu`} initial={{ opacity: 0, y: -4, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
                    {[['Chrome', chromeMark], ['Edge', edgeMark], ['Firefox', firefoxMark]].map(([name, mark]) => <div key={name} className={menu.item} data-step={name.toLowerCase()} data-highlighted={name === 'Chrome' || undefined}>
                      <img src={mark} alt="" width={16} height={16} />{name}
                    </div>)}
                  </motion.div>}</AnimatePresence>
                </div>
              </div>
              <div className={`${importStyles.fields} import-link`}><Input label={t('Link')} placeholder={t('Paste a link')} readOnly tabIndex={-1} /></div>
            </div> : <div className={`${importStyles.fields} ${importStyles.importForm}`}>
              <div className={importStyles.previewHeading}><Button variant="ghost" size="sm" tabIndex={-1} aria-label={t('Back to Link')}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /></Button><img src={chromeMark} alt="" width={20} height={20} /><h3>Chrome</h3></div>
              {phase === 'reading' ? <Skeleton label={t('Reading bookmarks')} lines={4} /> : <>
                <div className={importStyles.selection}><Checkbox label={t('Select all')} checked tabIndex={-1} /><span className={importStyles.counts}>{t('{count} selected', { count: imported.length })}</span></div>
                <div className={importStyles.bookmarks}><ul className={importStyles.list}>
                  {imported.map((item, i) => <li key={item.id} className={importStyles.bookmark}>
                    <Checkbox checked tabIndex={-1} aria-label={item.title} />
                    <SiteFavicon candidates={item.origin?.faviconUrl ? [item.origin.faviconUrl] : []} label={item.source} remoteFallback={false} />
                    <div><span className={importStyles.bookmarkTitle}>{copy.importing.bookmarks[i] ?? item.title}</span><div className={importStyles.bookmarkSource}><span>{language === 'zh' ? '书签栏' : 'Bookmarks bar'} / {item.tags[0]}</span></div></div>
                  </li>)}
                </ul></div>
              </>}
              <div className={importStyles.actions}>
                <Button variant="secondary" tabIndex={-1} disabled={phase === 'reading'}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />{t('Refresh bookmarks')}</Button>
                <Button variant="primary" data-step="submit" tabIndex={-1} disabled={phase === 'reading'}><Download size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import {count} links', { count: imported.length })}</Button>
              </div>
            </div>}
          </div>
        </>}
      </motion.div>}</AnimatePresence>
    </div>
    {auto.started && <Cursor {...script} />}
    <Button type="button" variant="ghost" size="sm" className="stage-replay" onClick={auto.replay}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />{copy.importing.replay}</Button>
  </div>;
}

/* Save page: the toolbar button opens the extension's real Save page sidebar
   (the same form), which reads the page; then Save page. */
function SaveVisual() {
  const { copy } = useSite();
  const text = copy.saving;
  const stage = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const script = useScript(stage);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [pressed, setPressed] = useState(false);
  const page = useMemo<StashItem>(() => ({ id: 'page', kind: 'web', title: text.pageTitle, source: 'Journal', url: 'https://journal.example/calm-interfaces', excerpt: text.pageBody, content: text.pageBody, tags: [], createdAt: new Date(0).toISOString(), origin: { platform: 'chrome', importMethod: 'browser_extension', importedAt: new Date(0).toISOString() } }), [text]);
  // A page-local stand-in for the extension's transport: it reads the page above and saves nowhere.
  const services = useMemo<PopupServices>(() => ({
    capture: () => new Promise(resolve => window.setTimeout(() => resolve(page), 650)),
    tags: async () => ['Design', 'Writing', 'Research'],
    save: () => new Promise(resolve => window.setTimeout(() => resolve({ saved: true }), 600)),
    close: () => {},
    providerStatus: async () => ({ connected: true }),
  }), [page]);
  useEffect(() => {
    if (!open || !host.current) return;
    const node = document.createElement('div');
    node.className = 'save-popup';
    host.current.appendChild(node);
    // The Popup focuses its title field on open; keep the page where it is.
    const scroll = window.scrollY;
    const unmount = renderPopup(node, services);
    const settle = window.setTimeout(() => { if (Math.abs(window.scrollY - scroll) > 2) window.scrollTo({ top: scroll }); }, 30);
    return () => { window.clearTimeout(settle); unmount(); node.remove(); };
  }, [open, session, services]);
  const auto = useAutoplay(() => void play());
  async function play() {
    const s = script.start();
    setOpen(false); setPressed(false); setSession(value => value + 1);
    s.place(stage.current ? stage.current.clientWidth * .45 : 300, stage.current ? stage.current.clientHeight * .7 : 300);
    if (!await s.wait(500)) return;
    if (!await s.move('[data-step="extension"]', 900)) return;
    setPressed(true); if (!await s.press()) return; setPressed(false);
    setOpen(true);
    if (!await s.wait(1700)) return;
    const submit = host.current?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!await s.move(submit ?? null, 900)) return;
    if (!await s.press()) return;
    submit?.click();
    if (!await s.wait(900)) return;
    await s.move('[data-step="page"]', 1000, .4, .55);
  }
  return <div className="save" ref={node => { stage.current = node; (auto.ref as { current: HTMLDivElement | null }).current = node; }}>
    <div className="browser" data-open={open || undefined}>
      <div className="browser-bar">
        <span className="browser-dots"><i /><i /><i /></span>
        <span className="browser-address">journal.example/calm-interfaces</span>
        <button type="button" className="browser-extension" data-step="extension" data-pressed={pressed || undefined} aria-label="StashDock" tabIndex={-1}><img src={brandMark} alt="" width={16} height={16} /></button>
      </div>
      <div className="browser-body">
        <div className="browser-page" data-step="page" aria-hidden="true">
          <span className="sketch-kicker" />
          <p className="display browser-headline">{text.pageTitle}</p>
          <p className="browser-text">{text.pageBody}</p>
          <span className="sketch-line" /><span className="sketch-line short" /><span className="sketch-line" />
          <span className="sketch-figure" />
        </div>
        <AnimatePresence>{open && <motion.aside key={session} className="browser-sidebar" ref={host} aria-label="Save page"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: .2 } }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}</AnimatePresence>
      </div>
    </div>
    {auto.started && <Cursor {...script} />}
    <Button type="button" variant="ghost" size="sm" className="stage-replay" onClick={auto.replay}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />{text.replay}</Button>
  </div>;
}

/* Agents: an AI saves a rule through MCP, and another conversation finds it later. */
function AgentsVisual() {
  const { copy, language } = useSite();
  const text = copy.agents;
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>('-30% 0px');
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const rule = useMemo(() => demoLibrary(language).find(item => item.id === 'rules')!, [language]);
  const steps = 7;
  useEffect(() => { if (inView && !run) setRun(1); }, [inView, run]);
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
