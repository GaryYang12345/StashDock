import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { SearchField } from '../../../src/components/arc/search-field/search-field';
import SegmentedControl from '../../../src/components/arc/segmented-control/segmented-control';
import { ScrollArea } from '../../../src/components/arc/scroll-area/scroll-area';
import { ReferenceCardView } from '../../../src/components/StashCard';
import { ReferenceMark } from '../../../src/components/SiteIdentity';
import { CardActionLabel } from '../../../src/components/CardActionLabel';
import { BrandIcon } from '../../../src/components/BrandIcon';
import { ReferenceViewToggle } from '../../../src/components/ReferenceViewToggle';
import { ShelfTagFilter } from '../../../src/components/ShelfTagFilter';
import { SelectAllReferences } from '../../../src/components/SelectAllReferences';
import { SelectionManagementActions } from '../../../src/components/SelectionManagementActions';
import { shelfFilters } from '../../../src/components/ReferenceShelf';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { useI18n } from '../../../src/features/settings/locale';
import card from '../../../src/components/StashCard.module.css';
import action from '../../../src/components/CopyForAI.module.css';
import header from '../../../src/components/DockHeader.module.css';
import context from '../../../src/components/ContextBar.module.css';
import listStyles from '../../../src/components/ReferenceList.module.css';
import shelf from '../../../src/features/mcp-app/McpShelf.module.css';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import type { StashItem } from '../../../src/types';
import { fileKinds, matches } from '../demo-data';
import { useDemoLibrary } from '../demo-editing';
import { demoCard, openDemoReference } from '../demo-navigation';
import { useDemoReferenceEditors } from '../parts/DemoReferenceEditors';
import { ChatWindow, type Chip } from '../parts/ChatWindow';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import './demo.css';

const PENDING_MS = 260;
const ADDED_MS = 1400;
type Filter = 'all' | 'recent' | 'web' | 'files' | 'favorites';

// Autoplay illustrations and composer chips have no source/file actions.
export const shown = ({ url: _url, assetPath: _asset, hasFile: _file, ...item }: StashItem): StashItem => item;
const recent = (items: StashItem[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
export function inCollection(item: StashItem, filter: string) {
  if (filter === 'web') return !fileKinds.has(item.kind) && item.kind !== 'note';
  if (filter === 'files') return fileKinds.has(item.kind);
  if (filter === 'favorites') return Boolean(item.favorite);
  return true;
}

/* The ChatGPT plugin beside a conversation: the panel follows McpShelf, with its
   header, collections, tag menu, selectable cards and selection bar. Import
   points to its section below; Settings and deleting are left out. */
export function LiveDemo() {
  const { copy, language } = useSite();
  const { t } = useI18n();
  const text = copy.demo;
  const reduced = useReducedMotion();
  const demo = useDemoLibrary(language);
  const source = demo.library;
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const tagTrigger = useRef<HTMLElement | null>(null);
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms); timers.current.add(id); };
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);
  useEffect(() => { setTag(''); setSelected([]); setChips([]); }, [language]);

  const library = useMemo(() => source.filter(item => !removed.has(item.id)).map(item => ({ ...item, favorite: favorites[item.id] ?? item.favorite })), [source, removed, favorites]);
  const editor = useDemoReferenceEditors({ ...demo, library });
  const byId = useMemo(() => new Map(library.map(item => [item.id, item])), [library]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    library.forEach(item => item.tags.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [library]);
  const items = useMemo(() => {
    const scoped = (filter === 'recent' ? recent(library) : library.filter(item => inCollection(item, filter))).filter(item => !tag || item.tags.includes(tag));
    return query.trim() ? matches(scoped, query) : scoped;
  }, [library, filter, tag, query]);

  // Add behaves as in the plugin: in flight, then green Added, then Add again.
  const add = (ids: string[]) => {
    if (pending.length || !ids.length) return;
    setPending(ids);
    later(() => {
      setPending([]);
      setChips(current => [...current, ...ids.filter(id => !current.includes(id))]);
      setAdded(current => new Set([...current, ...ids]));
      later(() => setAdded(current => { const next = new Set(current); ids.forEach(id => next.delete(id)); return next; }), ADDED_MS);
    }, PENDING_MS);
  };
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const remove = (ids: string[]) => {
    setRemoved(current => new Set([...current, ...ids]));
    setSelected(current => current.filter(id => !ids.includes(id)));
    setChips(current => current.filter(id => !ids.includes(id)));
  };
  const reset = () => {
    timers.current.forEach(id => window.clearTimeout(id)); timers.current.clear();
    demo.resetEdits(); setRemoved(new Set()); setFavorites({}); setQuery(''); setFilter('all'); setTag(''); setView('grid');
    setSelected([]); setChips([]); setPending([]); setAdded(new Set()); setResetToken(value => value + 1);
  };
  const chipList: Chip[] = chips.flatMap(id => { const item = byId.get(id); return item ? [{ key: id, mark: <ReferenceMark item={shown(item)} />, label: item.title, sub: text.context }] : []; });
  const changed = Boolean(demo.edited || removed.size || Object.keys(favorites).length || chips.length || selected.length || query || filter !== 'all' || tag || view !== 'grid');
  const list = new Intl.ListFormat(language === 'zh' ? 'zh-CN' : 'en', { type: 'conjunction' });
  const allSelected = items.length > 0 && items.every(item => selected.includes(item.id));
  const selectionAdded = selected.length > 0 && selected.every(id => added.has(id));

  return <section className="section demo" id="how" aria-labelledby="demo-title">
    <Reveal className="page section-head center">
      <h2 id="demo-title" className="display display-lg">{text.title}</h2>
      <p className="lede">{text.body}</p>
    </Reveal>
    <Reveal className="demo-desk" delay={80}>
      <ChatWindow className="demo-chat" head="ChatGPT" chips={chipList}
        hello={<><img className="chat-hello-mark" src={chatgptMark} alt="" width={56} height={56} /><p>{text.chatHello}</p></>}
        placeholder={text.placeholder} reply={labels => text.reply.replace('{titles}', list.format(labels.map(label => `“${label}”`)))}
        onRemove={key => setChips(current => current.filter(id => id !== key))} onSent={() => setChips([])}
        onReset={reset} resetToken={resetToken} canReset={changed} />

      <div className="demo-plugin no-delete" aria-label="StashDock">
        <main data-arc-ui className={shelf.root}>
          <header className={header.header}>
            <div className={header.top}><BrandIcon className={`${shelf.brand} demo-brand`} /><Button variant="secondary" size="sm" className="demo-import" aria-label={t('Import references')} onClick={() => document.getElementById('import')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /><span className="demo-import-label">{t('Import references')}</span></Button></div>
            <div className={`${header.search} ${shelf.searchRow}`}>
              <SearchField label={t('Search references')} placeholder={t('Search references')} value={query} onValueChange={setQuery} autoComplete="off" spellCheck={false} />
              <div className={shelf.viewToolbar}><ReferenceViewToggle value={view} onChange={setView} /></div>
            </div>
            <div className={`${header.filters} ${shelf.filters} demo-filters`}>
              <div className={`${header.filterOptions} demo-collections`}><SegmentedControl label={t('Collection')} options={shelfFilters.map(option => ({ ...option, label: t(option.label) }))} value={filter} onValueChange={value => { setFilter(value as Filter); setTag(''); }} /></div>
              <div className={shelf.tagToolbar}><ShelfTagFilter tags={tags} activeTag={tag} disabled={false} busy={false} triggerRef={tagTrigger} onFilter={name => { setTag(name); setFilter('all'); }} onEdit={() => {}} /></div>
              <Button type="button" variant="ghost" size="sm" aria-label={t('Refresh library')} loading={refreshing} onClick={() => { setRefreshing(true); later(() => setRefreshing(false), 600); }}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
            </div>
          </header>
          <ScrollArea label={t('References')} className={shelf.scroller} viewportClassName={`${shelf.content} ${selected.length ? shelf.contentWithSelection : ''}`} fade={0}>
            {items.length ? <div className={view === 'grid' ? `${shelf.list} demo-card-grid` : listStyles.list}>
              {items.map(item => <ReferenceCardView key={item.id} item={demoCard(item)} view={view} className={shelf.card}
                selected={selected.includes(item.id)} selectionDisabled={pending.length > 0}
                onToggle={toggle} onFavorite={id => setFavorites(current => ({ ...current, [id]: !(current[id] ?? source.find(entry => entry.id === id)?.favorite) }))}
                onDelete={reference => remove([reference.id])} onOpen={openDemoReference} onEdit={editor.openCard} onEditContent={editor.openContent}
                action={<Button variant="primary" size="sm" className={`${action.button} ${card.copyAction} ${added.has(item.id) && !pending.includes(item.id) ? action.success : ''}`}
                  loading={pending.includes(item.id)} aria-disabled={pending.length > 0 || undefined} onClick={() => add([item.id])}
                  aria-label={t('Add {title} to chat', { title: item.title })} aria-description={added.has(item.id) ? text.added : undefined}>
                  {added.has(item.id) ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
                  <CardActionLabel compact={added.has(item.id) ? text.added : text.addShort}>{added.has(item.id) ? text.added : text.add}</CardActionLabel>
                </Button>} />)}
            </div> : <p className="demo-empty small">{t('No matching references')}</p>}
          </ScrollArea>
          <AnimatePresence initial={false}>{selected.length > 0 && <motion.footer className={`${context.position} ${context.compact}`}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] }}>
            <div className={`${context.bar} ${shelf.footer}`}>
              <div className={context.selectionInfo}><div className={context.summaryHeading}>
                <p className={shelf.selectionCount}>{t('{count} selected', { count: selected.length })}</p>
                <SelectAllReferences disabled={pending.length > 0} allSelected={allSelected} onSelectAll={() => setSelected(current => [...new Set([...current, ...items.map(item => item.id)])])} />
              </div></div>
              <div className={context.actions}>
                <SelectionManagementActions disabled={pending.length > 0} onClear={() => setSelected([])} />
                <Button type="button" variant="primary" size="sm" className={`${action.button} ${!pending.length && selectionAdded ? action.success : ''}`} loading={pending.length > 1 || (pending.length === 1 && selected.length === 1 && pending[0] === selected[0])} onClick={() => add(selected)}>
                  {selectionAdded ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {selectionAdded ? text.added : text.add}
                </Button>
              </div>
            </div>
          </motion.footer>}</AnimatePresence>
        </main>
      </div>
    </Reveal>
    {editor.dialogs}
  </section>;
}
