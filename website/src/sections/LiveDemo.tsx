import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, Check, Mic, Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { SearchField } from '../../../src/components/arc/search-field/search-field';
import SegmentedControl from '../../../src/components/arc/segmented-control/segmented-control';
import { ScrollArea } from '../../../src/components/arc/scroll-area/scroll-area';
import { ReferenceCardView } from '../../../src/components/StashCard';
import { ReferenceMark } from '../../../src/components/SiteIdentity';
import { CardActionLabel } from '../../../src/components/CardActionLabel';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { BrandIcon } from '../../../src/components/BrandIcon';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import card from '../../../src/components/StashCard.module.css';
import action from '../../../src/components/CopyForAI.module.css';
import type { StashItem } from '../../../src/types';
import { demoLibrary, fileKinds, matches } from '../demo-data';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import { useI18n } from '../../../src/features/settings/locale';
import './demo.css';

const PENDING_MS = 260;
const ADDED_MS = 1400;
type Filter = 'all' | 'web' | 'files' | 'favorites';
type Message = { id: number; role: 'user' | 'ai'; text: string; refs?: StashItem[] };

// On the page there is nothing to open, so cards drop their link and file targets.
const shown = ({ url: _url, assetPath: _asset, hasFile: _file, ...item }: StashItem): StashItem => item;

export function LiveDemo() {
  const { copy, language } = useSite();
  const text = copy.demo;
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const source = useMemo(() => demoLibrary(language), [language]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms); timers.current.add(id); };
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);

  const library = useMemo(() => source.filter(item => !removed.has(item.id)).map(item => ({ ...item, favorite: favorites[item.id] ?? item.favorite })), [source, removed, favorites]);
  const byId = useMemo(() => new Map(library.map(item => [item.id, item])), [library]);
  // The three largest groups keep the row to one line in a narrow panel.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    source.forEach(item => item.tags.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  }, [source]);
  useEffect(() => setTag(''), [language]);
  const items = useMemo(() => {
    const scoped = library.filter(item => filter === 'all' ? true : filter === 'web' ? !fileKinds.has(item.kind) && item.kind !== 'note' : filter === 'files' ? fileKinds.has(item.kind) : item.favorite)
      .filter(item => !tag || item.tags.includes(tag));
    return query.trim() ? matches(scoped, query) : scoped;
  }, [library, filter, tag, query]);

  const add = (id: string) => {
    if (pending.has(id)) return;
    setPending(current => new Set(current).add(id));
    later(() => {
      setPending(current => { const next = new Set(current); next.delete(id); return next; });
      setChips(current => current.includes(id) ? current : [...current, id]);
      setAdded(current => new Set(current).add(id));
      later(() => setAdded(current => { const next = new Set(current); next.delete(id); return next; }), ADDED_MS);
    }, PENDING_MS);
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const refs = chips.map(id => byId.get(id)).filter(Boolean) as StashItem[];
    if (!refs.length || thinking) return;
    const list = new Intl.ListFormat(language === 'zh' ? 'zh-CN' : 'en', { type: 'conjunction' }).format(refs.map(item => `“${item.title}”`));
    setMessages(current => [...current, { id: Date.now(), role: 'user', text: draft.trim() || text.ask, refs }]);
    setChips([]); setDraft(''); setThinking(true);
    later(() => { setThinking(false); setMessages(current => [...current, { id: Date.now() + 1, role: 'ai', text: text.reply.replace('{titles}', list) }]); }, 1100);
  };
  const reset = () => {
    timers.current.forEach(id => window.clearTimeout(id)); timers.current.clear();
    setRemoved(new Set()); setFavorites({}); setQuery(''); setFilter('all'); setTag(''); setChips([]); setPending(new Set()); setAdded(new Set()); setMessages([]); setDraft(''); setThinking(false);
  };
  const changed = removed.size || Object.keys(favorites).length || chips.length || messages.length;
  const chipItems = chips.map(id => byId.get(id)).filter(Boolean) as StashItem[];

  return <section className="section demo" id="how" aria-labelledby="demo-title">
    <Reveal className="page section-head center">
      <h2 id="demo-title" className="display display-lg">{text.title}</h2>
      <p className="lede">{text.body}</p>
    </Reveal>
    <Reveal className="demo-desk" delay={80}>
      <div className="demo-chat" aria-label="ChatGPT">
        <header className="demo-chat-head">
          <img className="demo-chat-mark" src={chatgptMark} alt="ChatGPT" width={22} height={22} />
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!changed} data-tooltip={text.reset} aria-label={text.reset} className="demo-reset"><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
        </header>
        <div className="demo-thread" aria-live="polite">
          {!messages.length && !thinking && <div className="demo-hello"><img src={chatgptMark} alt="" width={56} height={56} /><p>{text.chatHello}</p></div>}
          <AnimatePresence initial={false}>
            {messages.map(message => <motion.div key={message.id} className={`bubble-row ${message.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
              {message.refs && <div className="bubble-refs">{message.refs.map(item => <span key={item.id} className="context-chip sent"><ReferenceMark item={shown(item)} /><span>{item.title}</span></span>)}</div>}
              <p className="bubble">{message.text}</p>
            </motion.div>)}
            {thinking && <motion.div key="thinking" className="bubble-row ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><p className="bubble typing" aria-label="…"><i /><i /><i /></p></motion.div>}
          </AnimatePresence>
        </div>
        <form className="composer" onSubmit={send}>
          <AnimatePresence initial={false}>
            {chipItems.length > 0 && <motion.div className="composer-chips" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
              <div className="composer-chips-inner">
                <AnimatePresence initial={false} mode="popLayout">
                  {chipItems.map(item => <motion.span key={item.id} layout={!reduced} className="context-chip" initial={{ opacity: 0, scale: .8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .8 }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
                    <ReferenceMark item={shown(item)} /><span className="context-chip-label"><small>{text.context}</small>{item.title}</span>
                    <button type="button" className="context-chip-remove" aria-label={`${text.remove} ${item.title}`} onClick={() => setChips(current => current.filter(id => id !== item.id))}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  </motion.span>)}
                </AnimatePresence>
              </div>
            </motion.div>}
          </AnimatePresence>
          <input className="composer-input" value={draft} onChange={event => setDraft(event.target.value)} placeholder={chipItems.length ? text.ask : text.placeholder} aria-label={text.placeholder} />
          <div className="composer-row">
            <span className="composer-tool" aria-hidden="true"><Plus size={20} strokeWidth={1.5} /></span>
            <span className="composer-spacer" />
            <span className="composer-tool" aria-hidden="true"><Mic size={18} strokeWidth={1.5} /></span>
            <Button type="submit" variant="primary" size="sm" className="composer-send" disabled={!chipItems.length || thinking} aria-label={text.send}><ArrowUp size={18} strokeWidth={2} aria-hidden="true" /></Button>
          </div>
        </form>
      </div>

      <div className="demo-library" aria-label={text.library}>
        <header className="demo-library-head">
          <BrandIcon className="demo-brand" />
          <SearchField label={text.search} placeholder={text.search} value={query} onValueChange={setQuery} autoComplete="off" spellCheck={false} />
          <SegmentedControl label={text.library} value={filter} onValueChange={value => setFilter(value as Filter)}
            options={[{ value: 'all', label: text.all }, { value: 'web', label: text.web }, { value: 'files', label: text.files }, { value: 'favorites', label: text.favorites }]} />
          <div className="demo-tags" role="group" aria-label={copy.collect.tagsLabel}>
            {['', ...tags].map(name => <Button key={name || 'all'} type="button" size="sm" variant={tag === name ? 'primary' : 'secondary'} aria-pressed={tag === name} onClick={() => setTag(name)}>{name || text.allTags}</Button>)}
          </div>
        </header>
        <ScrollArea className="demo-scroll" label={text.library} fade={24}>
          <LayoutGroup>
            <motion.div className="demo-grid" layout={!reduced}>
              <AnimatePresence mode="popLayout" initial={false}>
                {items.map(item => <motion.div key={item.id} layout={!reduced} initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97, transition: { duration: motionTokens.duration.exit } }}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
                  <ReferenceCardView item={shown(item)} view="grid" selected={false} selectable={false}
                    onToggle={() => {}} onFavorite={id => setFavorites(current => ({ ...current, [id]: !(current[id] ?? source.find(entry => entry.id === id)?.favorite) }))}
                    onDelete={reference => { setRemoved(current => new Set(current).add(reference.id)); setChips(current => current.filter(id => id !== reference.id)); }}
                    onOpen={() => {}}
                    action={<Button variant="primary" size="sm" className={`${action.button} ${card.copyAction} ${added.has(item.id) && !pending.has(item.id) ? action.success : ''}`}
                      loading={pending.has(item.id)} onClick={() => add(item.id)} aria-label={t('Add {title} to chat', { title: item.title })} aria-description={added.has(item.id) ? text.added : undefined}>
                      {added.has(item.id) ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
                      <CardActionLabel compact={added.has(item.id) ? text.added : text.addShort}>{added.has(item.id) ? text.added : text.add}</CardActionLabel>
                    </Button>} />
                </motion.div>)}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
          {!items.length && <p className="demo-empty small">{text.empty}</p>}
        </ScrollArea>
      </div>
    </Reveal>
  </section>;
}
