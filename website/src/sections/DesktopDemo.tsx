import { useCallback, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import SegmentedControl from '../../../src/components/arc/segmented-control/segmented-control';
import { ScrollArea } from '../../../src/components/arc/scroll-area/scroll-area';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { ReferenceCardView } from '../../../src/components/StashCard';
import { CopyForAI } from '../../../src/components/CopyForAI';
import { BrandIcon } from '../../../src/components/BrandIcon';
import { Sidebar } from '../../../src/components/Sidebar';
import { Toolbar } from '../../../src/components/Toolbar';
import { WindowControls } from '../../../src/components/WindowControls';
import { ShelfTagFilter } from '../../../src/components/ShelfTagFilter';
import { shelfFilters } from '../../../src/components/ReferenceShelf';
import { ReferenceGlyph, referenceVisual } from '../../../src/components/ReferenceVisual';
import { buildContext } from '../../../src/lib/context-format.mjs';
import { referenceDragPayload, referenceFileName } from '../../../src/lib/reference-drag';
import { isFileReference } from '../../../src/lib/fileReference';
import { useI18n } from '../../../src/features/settings/locale';
import lib from '../../../src/features/library/LibraryView.module.css';
import card from '../../../src/components/StashCard.module.css';
import listStyles from '../../../src/components/ReferenceList.module.css';
import type { CollectionFilter, StashItem } from '../../../src/types';
import { demoLibrary, matches } from '../demo-data';
import { ChatWindow, type Chip } from '../parts/ChatWindow';
import { DeskFolder, REFERENCE_TYPE } from '../parts/FloatingFolder';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import { inCollection, shown } from './LiveDemo';
import './desktop.css';

const marks = ['openai', 'claude-color', 'gemini-color', 'deepseek-color'].map(file => `${import.meta.env.BASE_URL}logos/${file}.svg`);
const cubic = (value: readonly number[]) => value as [number, number, number, number];

// What the desktop hands an AI app for one reference: the original file
// (a Note's is its .txt) and, except for a Note, the Markdown context beside it.
function attachments(item: StashItem): Chip[] {
  const md: Chip = { key: `${item.id}:md`, mark: <ReferenceGlyph kind="markdown" size={22} />, label: referenceFileName(item.title, 1), sub: 'Markdown' };
  if (!item.assetPath) return [md];
  const original: Chip = { key: `${item.id}:file`, mark: <ReferenceGlyph kind={item.kind === 'note' ? 'text' : referenceVisual(item).visual} size={22} />, label: item.assetPath, sub: item.assetPath.split('.').pop()?.toUpperCase() };
  return isFileReference(item) ? [original, md] : [original];
}

export function DesktopDemo() {
  const { copy, language } = useSite();
  const text = copy.desktop;
  const library = useMemo(() => demoLibrary(language), [language]);
  const area = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [progress, setProgress] = useState({ hovered: false, searched: false, delivered: false });
  const [panel, setPanel] = useState<{ query: string; origin: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const deliver = useCallback((item: StashItem) => {
    setChips(current => [...current, ...attachments(item).filter(chip => !current.some(existing => existing.key === chip.key))]);
    setProgress(current => ({ ...current, delivered: true }));
  }, []);
  const events = useMemo(() => ({
    onHover: () => setProgress(current => current.hovered ? current : { ...current, hovered: true }),
    onQuery: (query: string, results: number) => { if (query.trim() && results) setProgress(current => current.searched ? current : { ...current, searched: true }); },
    onOpen: (query: string) => {
      const folder = area.current?.querySelector<HTMLElement>('.desk-folder'), box = area.current?.getBoundingClientRect();
      const rect = folder?.getBoundingClientRect();
      const origin = rect && box ? `${rect.left - box.left + rect.width / 2}px ${rect.top - box.top + rect.height / 2}px` : '50% 100%';
      setPanel({ query, origin });
    },
    onHide: () => setHidden(true),
  }), []);
  // Clipboards may turn line ends into CRLF on the way back; compare normalized text.
  const normal = (value: string) => value.replace(/\r\n?/g, '\n').trim();
  const byContext = useMemo(() => new Map(library.map(item => [normal(buildContext([item])), item])), [library]);
  const drop = {
    accepts: (event: DragEvent) => event.dataTransfer.types.includes(REFERENCE_TYPE),
    onDrop: (event: DragEvent) => { const item = library.find(entry => entry.id === event.dataTransfer.getData(REFERENCE_TYPE)); if (item) deliver(item); },
    label: text.drop,
  };
  // The desktop puts files on the clipboard; the page can only carry text,
  // so a pasted StashDock context arrives as the files the desktop would paste.
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const item = byContext.get(normal(event.clipboardData.getData('text/plain')));
    if (!item) return;
    event.preventDefault(); deliver(item);
  };
  const list = new Intl.ListFormat(language === 'zh' ? 'zh-CN' : 'en', { type: 'conjunction' });
  const steps = [progress.hovered, progress.searched, progress.delivered];
  const current = steps.findIndex(done => !done);
  const reset = () => { setChips([]); setProgress({ hovered: false, searched: false, delivered: false }); setPanel(null); setHidden(false); setResetToken(value => value + 1); };

  return <section className="section desktop" id="desktop" aria-labelledby="desktop-title">
    <Reveal className="page section-head center">
      <h2 id="desktop-title" className="display display-lg">{text.title}</h2>
      <p className="lede">{text.body}</p>
    </Reveal>
    <Reveal className="desk-stage" delay={80}>
      <div className="desk-area" ref={area}>
        <ol className="desk-steps" aria-label="Steps">
          {text.steps.map((step, i) => <li key={step} data-done={steps[i] || undefined} data-current={i === current || undefined}>
            <span className="desk-step-mark">{steps[i] ? <Check size={12} strokeWidth={2.25} aria-hidden="true" /> : i + 1}</span>{step}
          </li>)}
          <li className="desk-step-note">{text.open}</li>
        </ol>
        <DeskFolder key={resetToken} bounds={area} events={events} hidden={Boolean(panel) || hidden} />
        <AnimatePresence>{hidden && !panel && <motion.button type="button" className="pill secondary small desk-restore" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => setHidden(false)}>{text.restore}</motion.button>}</AnimatePresence>
        <AnimatePresence>{panel && <DesktopPanel key="panel" query={panel.query} origin={panel.origin} library={library} onCollapse={() => setPanel(null)} />}</AnimatePresence>
      </div>
      <ChatWindow className="desk-chat" chips={chips} drop={drop} onPaste={paste}
        head={<><span className="desk-marks" aria-hidden="true">{marks.map(src => <img key={src} src={src} alt="" width={18} height={18} />)}</span>{text.appTitle}</>}
        hello={<p>{text.hello}</p>} placeholder={text.placeholder} ask={text.ask}
        reply={labels => text.reply.replace('{titles}', list.format(labels.map(label => `“${label}”`)))}
        onRemove={key => setChips(current => current.filter(chip => chip.key !== key))} onSent={() => setChips([])}
        onReset={reset} resetToken={resetToken} canReset={Boolean(chips.length || steps.some(Boolean) || panel || hidden)} />
    </Reveal>
  </section>;
}

/* The desktop library window (LibraryView): title bar, sidebar, toolbar and
   cards, opened out of the folder and collapsed back into it. */
function DesktopPanel({ query: initialQuery, origin, library, onCollapse }: { query: string; origin: string; library: StashItem[]; onCollapse: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null), tagRef = useRef<HTMLElement | null>(null);
  const items = useMemo(() => library.filter(item => !removed.has(item.id)).map(item => ({ ...item, favorite: favorites[item.id] ?? item.favorite })), [library, removed, favorites]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => item.tags.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
  const counts = useMemo(() => Object.fromEntries((['all', 'recent', 'web', 'files', 'favorites'] as CollectionFilter[]).map(key => [key, key === 'recent' ? Math.min(6, items.length) : items.filter(item => inCollection(item, key)).length])) as Record<CollectionFilter, number>, [items]);
  const visible = useMemo(() => {
    const scoped = (filter === 'recent' ? [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6) : items.filter(item => inCollection(item, filter))).filter(item => !activeTag || item.tags.includes(activeTag));
    return query.trim() ? matches(scoped, query) : scoped;
  }, [items, filter, activeTag, query]);
  const copyItem = async (item: StashItem) => {
    try { await navigator.clipboard.writeText(buildContext([item])); } catch { /* the paste demo matches the text either way */ }
    setCopied(item.id);
    window.setTimeout(() => setCopied(current => current === item.id ? '' : current), 1800);
  };
  const enter = reduced ? { duration: 0 } : { duration: .34, ease: cubic(motionTokens.ease.enter) };
  const leave = reduced ? { duration: 0 } : { duration: .23, ease: cubic(motionTokens.ease.inOut) };
  return <motion.div className="desk-panel" style={{ transformOrigin: origin }}
    initial={{ opacity: 0, scale: .22 }} animate={{ opacity: 1, scale: 1, transition: enter }} exit={{ opacity: 0, scale: .22, transition: leave }}>
    <div data-arc-ui className={`fluid-ui ${lib.root} ${lib.native}`}>
      <main className={`app-shell ${lib.shell}`}>
        <header className={lib.windowBar}>
          <BrandIcon className={lib.brand} />
          <div className={lib.windowActions}><WindowControls floatingWindow onCollapse={onCollapse} onClose={onCollapse} /></div>
        </header>
        <div className={lib.workspace}>
          <div className={lib.desktopNavigation}>
            <Sidebar active={filter} counts={counts} tags={tags} activeTag={activeTag} showBrand={false}
              onSelect={next => setFilter(next)} onSelectTag={tag => setActiveTag(tag)} />
          </div>
          <section className={lib.main}>
            <Toolbar query={query} refreshing={refreshing} onRefresh={() => { setRefreshing(true); window.setTimeout(() => setRefreshing(false), 600); }}
              view={view} searchRef={searchRef} onQueryChange={setQuery} onViewChange={setView}
              onAdd={() => document.getElementById('import')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              collectionControls={<SegmentedControl label={t('Collection')} options={shelfFilters.map(option => ({ ...option, label: t(option.label) }))} value={activeTag ? '' : filter} onValueChange={value => { setFilter(value as CollectionFilter); setActiveTag(null); }} />}
              tagControls={<ShelfTagFilter tags={tags} activeTag={activeTag || ''} disabled={false} busy={false} triggerRef={tagRef} onFilter={name => setActiveTag(name || null)} onEdit={() => {}} />} />
            <ScrollArea className={lib.scroller} viewportClassName={lib.content} label={t('References')} fade={0}>
              {visible.length ? <div className={view === 'grid' ? lib.grid : listStyles.list}>
                {visible.map(item => <ReferenceCardView key={item.id} item={shown(item)} view={view} selected={false} selectable={false}
                  onToggle={() => {}} onFavorite={id => setFavorites(current => ({ ...current, [id]: !(current[id] ?? library.find(entry => entry.id === id)?.favorite) }))}
                  onDelete={reference => setRemoved(current => new Set(current).add(reference.id))} onOpen={() => {}}
                  articleProps={{ draggable: true, onDragStart: event => {
                    Object.entries(referenceDragPayload([item])).forEach(([type, value]) => { if (value) event.dataTransfer.setData(type, value); });
                    event.dataTransfer.setData(REFERENCE_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy';
                  } }}
                  action={<CopyForAI className={card.copyAction} copied={copied === item.id} responsiveLabel onCopy={() => copyItem(item)} label={t('Copy {title} for AI', { title: item.title })} />} />)}
              </div> : <p className="demo-empty small">{t('No matching references')}</p>}
            </ScrollArea>
          </section>
        </div>
      </main>
    </div>
  </motion.div>;
}
