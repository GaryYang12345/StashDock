import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Check, Download, FileUp, Link, Plus, RefreshCw, SquarePen, X } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { Input } from '../../../src/components/arc/input/input';
import { Textarea } from '../../../src/components/arc/textarea/textarea';
import { Checkbox } from '../../../src/components/arc/checkbox/checkbox';
import { Skeleton } from '../../../src/components/arc/skeleton/skeleton';
import { FileUpload } from '../../../src/components/arc/file-upload/file-upload';
import { ReferenceCardView } from '../../../src/components/StashCard';
import { ReferenceGlyph } from '../../../src/components/ReferenceVisual';
import { ReferenceTagsField } from '../../../src/components/ReferenceTagsField';
import { SiteFavicon } from '../../../src/components/SiteIdentity';
import { BrandIcon } from '../../../src/components/BrandIcon';
import { PlatformGroup } from '../../../src/components/PlatformGroup';
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
import { demoLibrary, demoTagNames } from '../demo-data';
import { Cursor, useScript } from '../parts/Cursor';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import { ReplayButton, useFirstView } from '../parts/DemoPlayback';
import { shown } from './LiveDemo';
import './pillars.css';

const spring = motionTokens.spring.smooth;
const browsers = [['Chrome', chromeMark], ['Edge', edgeMark], ['Firefox', firefoxMark], ['Safari', safariMark]] as const;

export function Pillars() {
  const { copy } = useSite();
  return <section className="section pillars" id="features" aria-label={copy.nav.features}>
    <ImportPillar />
    <SavePillar />
    <AgentsPillar />
  </section>;
}

function Pillar({ id, title, body, flip, extra, stage }: { id?: string; title: string; body: string; flip?: boolean; extra?: ReactNode; stage: ReactNode }) {
  return <article className="pillar page" id={id} data-flip={flip || undefined}>
    <Reveal className="pillar-copy">
      <h2 className="display display-md">{title}</h2>
      <p className="lede">{body}</p>
      {extra}
    </Reveal>
    <Reveal className="pillar-stage" delay={100}>{stage}</Reveal>
  </article>;
}

/* ---------- Import: Link, Note, File and browser bookmarks, one after another ---------- */
type Chapter = 0 | 1 | 2;
type Dialog = { tab: 'link' | 'note' | 'file'; menu?: boolean; browser?: 'reading' | 'list'; progress?: number; url?: string; looking?: boolean; title?: string; content?: string; tags?: string[]; file?: boolean };

function ImportPillar() {
  const { copy, language } = useSite();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const text = copy.importing;
  const stage = useRef<HTMLDivElement | null>(null);
  const script = useScript(stage);
  const view = useFirstView<HTMLDivElement>();
  const library = useMemo(() => demoLibrary(language), [language]);
  const pick = (id: string) => library.find(item => item.id === id)!;
  const bookmarks = useMemo(() => ['design-spells', 'sft-rl-opd', 'uiverse', 'basic-pitch', 'arc-ui'].map(pick), [library]); // eslint-disable-line react-hooks/exhaustive-deps
  const [chapter, setChapter] = useState<Chapter>(0);
  const [cards, setCards] = useState<StashItem[]>([]);
  const [modal, setModal] = useState<Dialog | null>(null);
  const [pressed, setPressed] = useState('');
  const base = useMemo(() => [pick('model'), pick('card-ui'), pick('review')], [library]); // eslint-disable-line react-hooks/exhaustive-deps
  const [jump, setJump] = useState<{ chapter: Chapter; run: number }>({ chapter: 0, run: 0 });
  useEffect(() => { if (view.run) setJump(current => ({ chapter: 0, run: current.run + 1 })); }, [view.run]);
  useEffect(() => { if (jump.run) void play(jump.chapter); return () => script.stop(); }, [jump]); // eslint-disable-line react-hooks/exhaustive-deps

  async function play(from: Chapter) {
    const s = script.start();
    const ms = (value: number) => reduced ? 0 : value;
    setModal(null); setPressed('');
    // Each chapter adds to the library the earlier ones built.
    const earlier: StashItem[][] = [bookmarks, [pick('anti-defensive')]];
    setCards([...earlier.slice(0, from).reverse().flat(), ...base]);
    s.place(stage.current ? stage.current.clientWidth - 60 : 400, stage.current ? stage.current.clientHeight - 40 : 400);
    const click = async (selector: string, then: () => void, travel = 650) => {
      if (!await s.move(selector, ms(travel))) return false;
      setPressed(selector); if (!await s.press()) return false; setPressed('');
      then(); return s.wait(ms(380));
    };
    const type = async (value: string, set: (next: string) => void, each = 24) => {
      for (let i = 1; i <= value.length; i++) { set(value.slice(0, i)); if (!await s.wait(ms(each))) return false; }
      return true;
    };
    const patch = (next: Partial<Dialog>) => setModal(current => current ? { ...current, ...next } : current);
    const open = () => click('[data-step="import"]', () => setModal({ tab: 'link' }));
    const save = async (selector: string, added: StashItem[]) => {
      if (!await click(selector, () => setModal(null))) return false;
      setCards(current => [...added, ...current.filter(item => !added.some(entry => entry.id === item.id))]);
      return s.wait(ms(1500));
    };
    for (let next = from; next <= 2; next++) {
      setChapter(next as Chapter);
      if (!await s.wait(ms(500))) return;
      if (next === 0) {
        // Links: a whole browser's bookmarks at once.
        if (!await open()) return;
        if (!await click('[data-step="from"]', () => patch({ menu: true }))) return;
        if (!await s.wait(ms(500))) return;
        if (!await click('[data-step="chrome"]', () => patch({ menu: false, browser: 'reading' }))) return;
        if (!await s.wait(ms(800))) return;
        patch({ browser: 'list' });
        if (!await s.wait(ms(700))) return;
        if (!await click('[data-step="submit"]', () => patch({ progress: 0 }))) return;
        for (let i = 1; i <= bookmarks.length; i++) { if (!await s.wait(ms(240))) return; patch({ progress: i }); }
        if (!await s.wait(ms(800))) return;
        setModal(null);
        setCards(current => [...bookmarks, ...current.filter(item => !bookmarks.some(entry => entry.id === item.id))]);
        if (!await s.wait(ms(1500))) return;
      }
      if (next === 1) {
        const note = pick('anti-defensive');
        if (!await open()) return;
        if (!await click('[data-step="tab-note"]', () => patch({ tab: 'note' }))) return;
        if (!await s.move('[data-step="title"]', ms(500))) return;
        if (!await type(note.title, title => patch({ title }), 40)) return;
        if (!await s.move('[data-step="content"]', ms(500))) return;
        // Paste the reusable note as a whole, rather than slowly typing a long document.
        if (!await s.press()) return;
        patch({ content: note.content ?? '' });
        if (!await s.wait(ms(1100))) return;
        patch({ tags: note.tags.slice(0, 1) });
        if (!await s.wait(ms(500))) return;
        if (!await save('[data-step="save"]', [note])) return;
      }
      if (next === 2) {
        if (!await open()) return;
        if (!await click('[data-step="tab-file"]', () => patch({ tab: 'file' }))) return;
        if (!await click('[data-step="choose"]', () => {})) return;
        if (!await s.wait(ms(500))) return;
        const spec = pick('spec');
        patch({ file: true, title: spec.title, content: spec.content, tags: spec.tags });
        if (!await s.wait(ms(900))) return;
        if (!await save('[data-step="save"]', [spec])) return;
        await s.move('[data-step="grid"]', ms(900), .5, .3);
      }
    }
  }

  const stageNode = <div className="import" ref={node => { stage.current = node; (view.ref as { current: HTMLDivElement | null }).current = node; }}>
    <div className="import-panel">
      <main data-arc-ui className={`${shelf.root} import-shelf`}>
        <header className={header.header}>
          <div className={header.top}><BrandIcon className={shelf.brand} />
            <Button variant="secondary" size="sm" data-step="import" data-pressed={pressed === '[data-step="import"]' || undefined} tabIndex={-1}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import references')}</Button>
          </div>
        </header>
        <div className="import-grid" data-step="grid">
          <AnimatePresence initial={false} mode="popLayout">
            {cards.slice(0, 9).map((item, i) => <motion.div key={item.id} layout={!reduced} initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring, delay: Math.min(i, 5) * .05 } }} exit={{ opacity: 0 }}>
              <ReferenceCardView item={shown(item)} view="grid" selected={false} selectable={false} action={null} onToggle={() => {}} onFavorite={() => {}} onDelete={() => {}} onOpen={() => {}} />
            </motion.div>)}
          </AnimatePresence>
        </div>
      </main>
      <AnimatePresence>{modal && <motion.div key="overlay" className="import-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} />}</AnimatePresence>
      <AnimatePresence>{modal && <ImportDialog key="dialog" state={modal} bookmarks={bookmarks} />}</AnimatePresence>
    </div>
    {view.run > 0 && <Cursor {...script} />}
  </div>;
  return <Pillar id="import" title={text.title} body={text.body} stage={stageNode} extra={<div className="pillar-controls">
    <div className="chapters" role="tablist" aria-label={text.title}>
      {text.chapters.map((name, i) => <button key={name} type="button" role="tab" aria-selected={chapter === i} className="chapter" data-active={chapter === i || undefined} data-done={i < chapter || undefined}
        onClick={() => setJump(current => ({ chapter: i as Chapter, run: current.run + 1 }))}>
        <span>{name}</span>
      </button>)}
    </div>
    <ReplayButton label={text.replay} onClick={() => setJump(current => ({ chapter: 0, run: current.run + 1 }))} />
  </div>} />;
}

// The import dialog drawn from DesktopImportDialog's styles and Arc fields; its
// values are set by the script, so it never takes focus from the page.
function ImportDialog({ state, bookmarks }: { state: Dialog; bookmarks: StashItem[] }) {
  const { language } = useSite();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const progress = state.progress !== undefined;
  const tabs = [['link', Link, 'Link'], ['note', SquarePen, 'Note'], ['file', FileUp, 'File']] as const;
  const tagField = useRef<HTMLDivElement>(null);
  const saveLabel = state.tab === 'link' ? 'Save link' : state.tab === 'note' ? 'Save note' : 'Save file';
  return <motion.div className="import-dialog" data-progress={progress || undefined} layout={!reduced} inert
    initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98, transition: { duration: .18 } }} transition={reduced ? { duration: 0 } : spring}>
    {progress ? <div className="import-progress"><ImportProgress completed={state.progress!} total={bookmarks.length} /></div> : <>
      <div className={dialog.header}><h3 className={dialog.title}>{t('Import references')}</h3><Button variant="ghost" size="sm" className={dialog.close} tabIndex={-1} aria-label={t('Close')}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button></div>
      <div className={dialog.body}>
        {state.browser ? <div className={`${importStyles.fields} ${importStyles.importForm}`}>
          <div className={importStyles.previewHeading}><Button variant="ghost" size="sm" tabIndex={-1} aria-label={t('Back to Link')}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /></Button><img src={chromeMark} alt="" width={20} height={20} /><h3>Chrome</h3></div>
          {state.browser === 'reading' ? <Skeleton label={t('Reading bookmarks')} lines={4} /> : <>
            <div className={importStyles.selection}><Checkbox label={t('Select all')} checked tabIndex={-1} /><span className={importStyles.counts}>{t('{count} selected', { count: bookmarks.length })}</span></div>
            <div className={importStyles.bookmarks}><ul className={importStyles.list}>
              {bookmarks.map(item => <li key={item.id} className={importStyles.bookmark}>
                <Checkbox checked tabIndex={-1} aria-label={item.title} />
                <SiteFavicon candidates={item.origin?.faviconUrl ? [item.origin.faviconUrl] : []} label={item.source} remoteFallback={false} />
                <div><span className={importStyles.bookmarkTitle}>{item.title}</span><div className={importStyles.bookmarkSource}><span>{language === 'zh' ? '书签栏' : 'Bookmarks bar'} / {item.tags[0]}</span></div></div>
              </li>)}
            </ul></div>
          </>}
          <div className={importStyles.actions}>
            <Button variant="secondary" tabIndex={-1} disabled={state.browser === 'reading'}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />{t('Refresh bookmarks')}</Button>
            <Button variant="primary" data-step="submit" tabIndex={-1} disabled={state.browser === 'reading'}><Download size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import {count} links', { count: bookmarks.length })}</Button>
          </div>
        </div> : <div className={importStyles.importTabs}>
          <div className={importStyles.typeBar}>
            <div className="import-tabs" role="presentation">
              {tabs.map(([value, Icon, label]) => <span key={value} data-step={`tab-${value}`} data-active={state.tab === value || undefined}><Icon size={16} strokeWidth={1.75} aria-hidden="true" />{t(label)}</span>)}
            </div>
            {state.tab === 'link' && <div className="import-from">
              <Button variant="secondary" size="sm" data-step="from" tabIndex={-1}><Download size={16} strokeWidth={1.75} aria-hidden="true" />{t('Import from')}</Button>
              <AnimatePresence>{state.menu && <motion.div className={`${menu.menu} import-menu`} initial={{ opacity: 0, y: -4, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
                {browsers.map(([name, mark]) => <div key={name} className={menu.item} data-step={name.toLowerCase()} data-highlighted={name === 'Chrome' || undefined}><img src={mark} alt="" width={16} height={16} />{name}</div>)}
                <div className={menu.separator} />
                <div className={menu.item}><PlatformGroup /></div>
              </motion.div>}</AnimatePresence>
            </div>}
          </div>
          <div className={`${importStyles.fields} ${importStyles.importForm} import-form`}>
            {state.tab === 'link' && <>
              <div className={importStyles.linkRow}>
                <div data-step="url"><Input label={t('Link')} placeholder={t('Paste a link')} value={state.url ?? ''} readOnly tabIndex={-1} /></div>
                {state.url && <Input label={t('Title')} value={state.title ?? ''} placeholder={state.looking ? `${t('Reading title')}…` : 'radix-ui.com'} readOnly tabIndex={-1} />}
              </div>
              {state.url && <Textarea label={t('Content')} rows={3} value={state.content ?? ''} placeholder={state.looking ? `${t('Reading content')}…` : t('Add or edit the content for AI')} readOnly tabIndex={-1} />}
              {state.url && <ReferenceTagsField value={state.tags ?? []} onValueChange={() => {}} availableTags={[]} fieldRef={tagField} />}
            </>}
            {state.tab === 'note' && <>
              <div data-step="title"><Input label={t('Title')} value={state.title ?? ''} placeholder={t('Note title')} readOnly tabIndex={-1} /></div>
              <div data-step="content"><Textarea label={t('Content')} rows={3} value={state.content ?? ''} placeholder={t('Write or paste a note')} readOnly tabIndex={-1} /></div>
              <ReferenceTagsField value={state.tags ?? []} onValueChange={() => {}} availableTags={[]} fieldRef={tagField} />
            </>}
            {state.tab === 'file' && (state.file ? <>
              <div className={importStyles.fileHeading}><ReferenceGlyph kind="pdf" size={20} /><span>{state.title}</span><Button variant="secondary" size="sm" tabIndex={-1}>{t('Replace files')}</Button></div>
              <Input label={t('Title')} value={state.title ?? ''} readOnly tabIndex={-1} />
              <Textarea label={t('Content')} rows={3} value={state.content ?? ''} readOnly tabIndex={-1} />
              <ReferenceTagsField value={state.tags ?? []} onValueChange={() => {}} availableTags={[]} fieldRef={tagField} />
            </> : <div data-step="choose"><FileUpload showBrowse={false} droppable={false} onBrowse={() => {}} value={[]} onChange={() => {}} multiple label={t('Choose files')} description={t('Up to 30 MB each.')} /></div>)}
            <div className={importStyles.actions}><Button type="button" variant="primary" data-step="save" tabIndex={-1}
              disabled={state.tab === 'link' ? !state.url : state.tab === 'note' ? !state.content : !state.file}>{state.tab === 'link' && <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}{t(saveLabel)}</Button></div>
          </div>
        </div>}
      </div>
    </>}
  </motion.div>;
}

/* ---------- Save page: the extension's real sidebar reads and saves a page ---------- */
function SavePillar() {
  const { copy, language } = useSite();
  const text = copy.saving;
  const stage = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const script = useScript(stage);
  const view = useFirstView<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [pressed, setPressed] = useState(false);
  const page = useMemo(() => demoLibrary(language).find(item => item.id === 'radix')!, [language]);
  // A page-local stand-in for the extension's transport: it reads the page above and saves nowhere.
  const services = useMemo<PopupServices>(() => ({
    capture: () => new Promise(resolve => window.setTimeout(() => resolve(page), 650)),
    tags: async () => [...demoTagNames],
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
  useEffect(() => { if (view.run) void play(); return () => script.stop(); }, [view.run]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const stageNode = <div className="save" ref={node => { stage.current = node; (view.ref as { current: HTMLDivElement | null }).current = node; }}>
    <div className="browser" data-open={open || undefined}>
      <div className="browser-bar">
        <span className="browser-dots"><i /><i /><i /></span>
        <span className="browser-address">{new URL(page.url!).hostname}</span>
        <button type="button" className="browser-extension" data-step="extension" data-pressed={pressed || undefined} aria-label="StashDock" tabIndex={-1}><img src={brandMark} alt="" width={16} height={16} /></button>
      </div>
      <div className="browser-body">
        <div className="browser-page" data-step="page" aria-hidden="true">
          <span className="sketch-kicker" />
          <p className="display browser-headline">{page.title}</p>
          <p className="browser-text">{page.excerpt}</p>
          <span className="sketch-line" /><span className="sketch-line short" /><span className="sketch-line" />
          <span className="sketch-figure" />
        </div>
        <AnimatePresence>{open && <motion.aside key={session} className="browser-sidebar" ref={host} aria-label="Save page"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: .2 } }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}</AnimatePresence>
      </div>
    </div>
    {view.run > 0 && <Cursor {...script} />}
  </div>;
  return <Pillar title={text.title} body={text.body} flip stage={stageNode} extra={<>
    <div className="browser-marks">
      <span>{browsers.map(([name, mark]) => <img key={name} src={mark} alt={name} width={28} height={28} />)}</span>
      <p className="small">{text.browsers}</p>
    </div>
    <div className="pillar-controls"><ReplayButton label={text.replay} onClick={view.restart} /></div>
  </>} />;
}

/* ---------- Agents: an AI saves a rule through MCP; another conversation finds it ---------- */
function AgentsPillar() {
  const { copy, language } = useSite();
  const text = copy.agents;
  const reduced = useReducedMotion();
  const view = useFirstView<HTMLDivElement>();
  const [step, setStep] = useState(0);
  const rule = useMemo(() => demoLibrary(language).find(item => item.id === 'anti-defensive')!, [language]);
  const steps = 7;
  useEffect(() => {
    if (!view.run) return;
    if (reduced) { setStep(steps); return; }
    setStep(0);
    const delays = [300, 1100, 1900, 3000, 3700, 4500, 5300];
    const ids = delays.map((delay, i) => window.setTimeout(() => setStep(i + 1), delay));
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [view.run, reduced]);
  const appear = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: reduced ? { duration: 0 } : spring };
  const stageNode = <div className="agents" ref={view.ref}>
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
        <img className="agents-note-cover" src={rule.preview} alt="" loading="lazy" decoding="async" width={720} height={405} />
        <b>{rule.title}</b>
        <small>{rule.excerpt}</small>
        {rule.tags[0] && <span className="agents-tag">{rule.tags[0]}</span>}
      </motion.div>}</AnimatePresence>
      <span className="agents-ghost" /><span className="agents-ghost" />
    </div>
  </div>;
  return <Pillar id="agents" title={text.title} body={text.body} stage={stageNode}
    extra={<div className="pillar-controls"><ReplayButton label={text.replay} onClick={view.restart} disabled={view.run > 0 && step < steps} /></div>} />;
}
