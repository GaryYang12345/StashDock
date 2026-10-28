import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { motionTokens } from './arc/lib/motion-tokens';
import { ArrowLeft, Check, Download, FileUp, Link, Plus, RefreshCw, SquarePen } from 'lucide-react';
import { FluidDialog } from './FluidDialog';
import { Button } from './arc/button/button';
import { PlatformGroup } from './PlatformGroup';
import { Input } from './arc/input/input';
import { Textarea } from './arc/textarea/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './arc/tabs/tabs';
import { DropdownMenu } from './arc/dropdown-menu/dropdown-menu';
import { Checkbox } from './arc/checkbox/checkbox';
import { ReferenceTagsField } from './ReferenceTagsField';
import { Skeleton } from './arc/skeleton/skeleton';
import { Alert } from './arc/alert/alert';
import { SiteFavicon } from './SiteIdentity';
import { faviconCandidates } from '../lib/siteIdentity';
import { normalizeFavicon } from '../lib/siteIdentity';
import { cleanReferenceTags } from '../features/library/store';
import { chooseReferenceFiles, importChosenReferenceFiles, importReferenceFiles } from '../lib/storage';
import { isTauri } from '@tauri-apps/api/core';
import { ReferenceFileImport } from './ReferenceFileImport';
import type { ChosenFile, ChosenFileDraft, FileReferencePayload } from '../lib/fileReference';
import { bookmarkCandidates, desktopLinkImport, makeBrowserLinks, makeLink, normalizeLink, settleImportedLink, readImportDetails, importCapacityError, type BrowserSource, type LinkImportService, type LinkPreview } from '../lib/linkImport';
import { ImportProgress } from './ImportProgress';
import type { StashItem } from '../types';
import styles from './DesktopImportDialog.module.css';
import chromeIcon from '../assets/brands/chrome.svg?inline';
import edgeIcon from '../assets/brands/edge.svg?inline';
import firefoxIcon from '../assets/brands/firefox.svg?inline';
import safariIcon from '../assets/brands/safari.svg?inline';
import { bookmarkBrowsers, readBookmarkFile } from '../lib/bookmarkFile';
import { BrowserCapturePanel } from './BrowserCapturePanel';
import { ReferenceCoverField } from './ReferenceCoverField';
import { withReferenceCover, type ReferenceCover } from '../lib/referenceCover';

type Props = {
    open: boolean;
    onClose: () => void;
    onAdd: (items: StashItem[], persisted?: boolean) => Promise<void>;
    /** Replace the saved reference with the same link, after the user confirms. */
    onReplace?: (item: StashItem) => Promise<void>;
    availableTags?: string[];
    existingItems?: StashItem[];
    services?: LinkImportService;
    onImportFiles?: (files: FileReferencePayload[], tags: string[]) => Promise<StashItem[]>;
    onChooseFiles?: () => Promise<ChosenFile[]>;
    onImportChosenFiles?: (files: ChosenFileDraft[], tags: string[]) => Promise<StashItem[]>;
};
type Candidate = ReturnType<typeof bookmarkCandidates>[number];
function BrowserIcon({ browser }: {
    browser: string;
}) { return <img className={styles.browserIcon} src={({ Chrome: chromeIcon, Edge: edgeIcon, Firefox: firefoxIcon, Safari: safariIcon } as Record<string, string>)[browser]} alt="" aria-hidden="true"/>; }
// Shortest time the batch progress surface stays up, so an import is felt.
const BATCH_PROGRESS_MIN_MS = 900;
export function DesktopImportDialog({ open, onClose, onAdd, onReplace, availableTags = [], existingItems = [], services = desktopLinkImport, onImportFiles = importReferenceFiles, onChooseFiles = services === desktopLinkImport && isTauri() ? chooseReferenceFiles : undefined, onImportChosenFiles = importChosenReferenceFiles }: Props) {
  const { t } = useI18n();
    const [mode, setMode] = useState('link');
    // The file form keeps its own chosen files and edits; once opened it stays
    // mounted (hidden) so switching tabs does not discard them.
    const [fileOpened, setFileOpened] = useState(false);
    if (mode === 'file' && !fileOpened) setFileOpened(true);
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [covers, setCovers] = useState<Record<string, ReferenceCover | null>>({});
    const [coverReading, setCoverReading] = useState(false);
    const [sources, setSources] = useState<BrowserSource[]>([]);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [browserPhase, setBrowserPhase] = useState<'ready' | 'needsAccess' | 'unavailable' | 'error'>('ready');
    const [source, setSource] = useState<BrowserSource | null>(null);
    const [platform, setPlatform] = useState<boolean | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    // A link that is already saved waits here until the user chooses to replace it.
    const [replacing, setReplacing] = useState<{ item: StashItem; title?: string; prepare: (batch: StashItem[]) => Promise<StashItem[]> } | null>(null);
    const flight = useRef(false);
    const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
    const lookupRequest = useRef<{ url: string; service: LinkImportService; version: number; promise: Promise<LinkPreview> } | null>(null);
    const lookup = (value: string) => {
        if (lookupRequest.current?.url === value && lookupRequest.current.service === services && lookupRequest.current.version === generation.current) return lookupRequest.current.promise;
        const version = generation.current;
        const promise = Promise.resolve().then(() => readImportDetails(value, services.preview, () => generation.current === version && lookupRequest.current?.url === value));
        lookupRequest.current = { url: value, service: services, version, promise };
        return promise;
    };
    const [reading, setReading] = useState(false);
    const [error, setError] = useState('');
    const [lookupError, setLookupError] = useState('');
    const [looking, setLooking] = useState(false);
    const reducedMotion = useReducedMotion();
    const [readingDots, setReadingDots] = useState(1);
    useEffect(() => {
        if (!looking || !open || reducedMotion) return;
        setReadingDots(1);
        const timer = setInterval(() => setReadingDots(value => value % 3 + 1), motionTokens.duration.considered * 1000);
        return () => clearInterval(timer);
    }, [looking, open, reducedMotion]);
    const dots = '.'.repeat(reducedMotion ? 3 : readingDots);
    const [preview, setPreview] = useState<LinkPreview | null>(null);
    const [retry, setRetry] = useState(0);
    const [urlError, setUrlError] = useState('');
    const [visibleCount, setVisibleCount] = useState(100);
    const drafts = useRef<Record<string, {
        title: string;
        content: string;
    }>>({});
    const edited = useRef({ title: false, content: false });
    const generation = useRef(0);
    const attemptedIcons = useRef(new Set<string>());
    const iconView = useRef({ open, mode, sourceId: source?.id, busy });
    iconView.current = { open, mode, sourceId: source?.id, busy };
    const bookmarkInput = useRef<HTMLInputElement>(null);
    const tagField = useRef<HTMLDivElement>(null);
    const currentTags = useRef<string[]>([]);
    let normalized = '';
    try {
        normalized = normalizeLink(url);
    }
    catch { /* Keep invalid input editable. */ }
    const reset = () => { setMode('link'); setFileOpened(false); setPlatform(null); setUrl(''); setTitle(''); setContent(''); setTags([]); setCovers({}); setCoverReading(false); setProgress(null); lookupRequest.current = null; currentTags.current = []; setSource(null); setCandidates([]); setSelected(new Set()); setError(''); setUrlError(''); setLookupError(''); setPreview(null); drafts.current = {}; edited.current = { title: false, content: false }; };
    useEffect(() => {
        if (!open || !services.available())
            return;
        let current = true;
        setSourceLoading(true);
        setSources([]);
        services.sources().then(items => { if (current)
            setSources(items); }).catch(reason => { if (current)
            setError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'Browser profiles could not be found. Retry or add a link manually.'); }).finally(() => { if (current)
            setSourceLoading(false); });
        return () => { current = false; };
    }, [open, services]);
    useEffect(() => {
        if (!open || mode !== 'link' || source || platform || !normalized || !services.available()) {
            setLooking(false);
            return;
        }
        let current = true;
        setLooking(true);
        setLookupError('');
        const version = generation.current;
        const isCurrent = () => current && generation.current === version;
        const timer = setTimeout(() => {
            lookup(normalized).then(result => {
                if (!isCurrent())
                    return;
                setPreview(result);
                if (!edited.current.title)
                    setTitle(result.title);
                if (!edited.current.content)
                    setContent(result.content);
            }).catch(reason => { if (isCurrent())
                setLookupError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'Could not read this page. You can enter its details manually.'); }).finally(() => { if (isCurrent())
                setLooking(false); });
        }, 650);
        return () => { current = false; clearTimeout(timer); };
    }, [open, mode, source, platform, normalized, services, retry]);
    useEffect(() => { if (!open)
        generation.current++; }, [open]);
    useEffect(() => () => { generation.current++; }, []);
    useEffect(() => {
        if (!open || mode !== 'link' || !source || reading || busy || !services.icons) return;
        const urls = candidates.slice(0, visibleCount).filter(item => !normalizeFavicon(item.faviconUrl) && !attemptedIcons.current.has(item.url)).map(item => item.url);
        urls.forEach(url => attemptedIcons.current.add(url));
        const version = generation.current;
        // Read cached icons immediately; enrich only displayed missing rows, in
        // bounded batches. Both hosts use the same validated native rasterizer.
        void (async () => {
            for (let offset = 0; offset < urls.length; offset += 12) {
                if (version !== generation.current || !iconView.current.open || iconView.current.busy || iconView.current.mode !== 'link' || iconView.current.sourceId !== source.id) return;
                try {
                    const icons = await services.icons!(urls.slice(offset, offset + 12));
                    if (version !== generation.current || !iconView.current.open || iconView.current.mode !== 'link' || iconView.current.sourceId !== source.id) return;
                    setCandidates(items => items.map(item => {
                        const faviconUrl = normalizeFavicon(icons[item.url]);
                        return faviconUrl ? { ...item, faviconUrl, origin: { ...item.origin, faviconUrl } } : item;
                    }));
                } catch { /* Optional icons never block selecting or importing. */ }
            }
        })();
    }, [open, mode, source, reading, busy, candidates, visibleCount, services]);
    const updateTags = (next: string[]) => {
        try {
            const values = cleanReferenceTags(next.map(name => availableTags.find(tag => tag.toLowerCase() === name.trim().toLowerCase()) ?? name));
            currentTags.current = values;
            setTags(values);
            setError('');
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'This tag could not be added.');
        }
    };
    const committedTags = () => {
        const draft = tagField.current?.querySelector('input')?.value.trim() || '';
        const canonical = availableTags.find(tag => tag.toLowerCase() === draft.toLowerCase()) ?? draft;
        return cleanReferenceTags(canonical && !currentTags.current.some(tag => tag.toLowerCase() === canonical.toLowerCase()) ? [...currentTags.current, canonical] : currentTags.current);
    };
    // `saved` reports real progress as chunks are written (batch imports).
    const save = async (items: StashItem[], persisted = false, prepare?: (batch: StashItem[], offset: number) => Promise<StashItem[]>, saved?: (count: number) => void, commit: (items: StashItem[], persisted?: boolean) => Promise<void> = onAdd) => {
        if (flight.current) return;
        flight.current = true;
        const version = generation.current;
        setBusy(true);
        setError('');
        const started = performance.now();
        try {
            // Bound retained bodies and each IPC payload, not just request count.
            // Already committed chunks survive a host close or later save error.
            const batchSize = prepare || saved ? 8 : Math.max(1, items.length);
            for (let offset = 0; offset < items.length; offset += batchSize) {
                if (version !== generation.current) return;
                const batch = items.slice(offset, offset + batchSize);
                const prepared = prepare ? await prepare(batch, offset) : batch;
                if (version !== generation.current) return;
                await commit(prepared, persisted);
                saved?.(Math.min(items.length, offset + batch.length));
            }
            setProgress(current => current ? { ...current, completed: current.total } : null);
            // Saving is quick; let the completed bar be seen before closing.
            if (saved) await new Promise(resolve => setTimeout(resolve, Math.max(0, BATCH_PROGRESS_MIN_MS - (performance.now() - started))));
            if (version !== generation.current) return;
            onClose();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'References could not be saved. Try again.');
        }
        finally {
            flight.current = false;
            setBusy(false);
            setProgress(null);
        }
    };
    const readSource = async (next: BrowserSource, file?: File, requestAccess = false) => {
        const version = ++generation.current;
        attemptedIcons.current.clear();
        const sameBrowser = source?.browser === next.browser;
        setSource(next); setReading(true); setError('');
        if (!sameBrowser) { setCandidates([]); setSelected(new Set()); }
        try {
            let bookmarks;
            if (file) bookmarks = await readBookmarkFile(file);
            else if (services.readBrowser) {
                const result = await services.readBrowser(next.browser, requestAccess);
                if (generation.current !== version) return;
                if (result.status !== 'ready') {
                    setBrowserPhase(result.status); setCandidates([]); setSelected(new Set()); return;
                }
                bookmarks = result.bookmarks;
            } else {
                const profiles = sources.filter(item => item.browser === next.browser);
                if (!profiles.length) { setBrowserPhase('unavailable'); setCandidates([]); setSelected(new Set()); return; }
                bookmarks = [];
                for (const profile of profiles) {
                    if (generation.current !== version) return;
                    bookmarks.push(...await services.bookmarks(profile.id));
                    if (bookmarks.length > 50_000) throw Error('This bookmark collection is too large to read in one import.');
                }
            }
            if (generation.current !== version) return;
            const urls = await services.existingUrls?.() ?? [];
            const items = bookmarkCandidates(bookmarks, next, [...existingItems, ...urls.map(url => ({ url } as StashItem))]);
            if (generation.current !== version) return;
            setBrowserPhase('ready'); setVisibleCount(100); setCandidates(items);
            setSelected(new Set(items.filter(item => !item.saved).map(item => item.key)));
        } catch (reason) {
            if (generation.current === version) {
                setBrowserPhase('error');
                setError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'Bookmarks could not be read. Retry the import.');
            }
        } finally {
            if (generation.current === version) setReading(false);
        }
    };
    const tagsField = <ReferenceTagsField value={tags} onValueChange={updateTags} availableTags={availableTags} fieldRef={tagField} busy={busy} />;
    const coverField = services.prepareCover && <ReferenceCoverField value={covers[mode] ?? null} onChange={cover => setCovers(current => ({ ...current, [mode]: cover }))} prepare={services.prepareCover} disabled={busy} onPreparing={setCoverReading} />;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || coverReading)
            return;
        setError('');
        try {
            const values = committedTags();
            if (mode === 'link') {
                const version = generation.current;
                const existingUrls = await services.existingUrls?.() ?? [];
                if (version !== generation.current) return;
                const same = (candidate?: string) => { try { return Boolean(candidate) && normalizeLink(candidate!) === normalizeLink(url); } catch { return false; } };
                const duplicate = existingItems.find(item => same(item.url)) ?? (existingUrls.some(same) ? {} as Partial<StashItem> : undefined);
                if (duplicate && !onReplace) {
                    setError('This link is already in your library.');
                    return;
                }
                const item = makeLink({ url, title, content, tags: values, faviconUrl: preview?.faviconUrl, preview: preview?.preview });
                if (item.origin && edited.current.content) item.origin.contentEdited = true;
                if (item.origin && preview?.previewKind) item.origin.previewKind = preview.previewKind;
                const prepare = async () => {
                    let details: LinkPreview | undefined;
                    try { if (services.available()) details = await lookup(normalized); } catch (error) { if (importCapacityError(error)) throw error; /* Unavailable pages remain valid links. */ }
                    const settled = settleImportedLink(item, edited.current.content ? { ...details, title: details?.title || item.title, content } : details);
                    if (!edited.current.title && details?.title.trim()) settled.title = details.title;
                    return [withReferenceCover(settled, covers.link ?? null)];
                };
                if (duplicate) {
                    setReplacing({ item, title: duplicate.title, prepare });
                    return;
                }
                await save([item], false, prepare);
            }
            else {
                if (!content.trim()) {
                    setError('Add some content to save this note.');
                    return;
                }
                const now = new Date().toISOString();
                await save([withReferenceCover({ id: crypto.randomUUID(), kind: 'note', title: title.trim() || Array.from(content.trim().split('\n')[0]).slice(0, 80).join(''), source: 'Personal note', excerpt: Array.from(content.trim()).slice(0, 180).join(''), content, tags: values, createdAt: now, origin: { platform: 'StashDock', importMethod: 'note', importedAt: now } }, covers.note ?? null)]);
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Enter a valid link.');
        }
    };
    const available = candidates.filter(item => !item.saved);
    const browsers = services.available() ? bookmarkBrowsers.map(browser => sources.find(item => item.browser === browser) ?? { id: `export:${browser}`, browser, profile: '' }) : [];
    const selectedCount = available.filter(item => selected.has(item.key)).length;
    return <FluidDialog open={open} onClose={onClose} onExited={reset} busy={busy || coverReading} size="import" title={t(progress ? 'Importing references' : 'Import references')} progress={progress && <ImportProgress completed={progress.completed} total={progress.total} />}>
    <Tabs className={styles.importTabs} value={mode} onValueChange={next => { if (busy || coverReading)
        return; drafts.current[mode] = { title, content }; generation.current++; setReading(false); setMode(next); setPlatform(null); setSource(null); setError(''); setTitle(drafts.current[next]?.title || ''); setContent(drafts.current[next]?.content || ''); setPreview(null); edited.current = { title: Boolean(drafts.current[next]?.title), content: Boolean(drafts.current[next]?.content) }; }}>
      <div className={styles.typeBar}><TabsList aria-label={t("Reference type")}><TabsTrigger className={styles.typeTab} value="link" disabled={busy}><span className={styles.tabLabel}><Link size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Link")}</span></TabsTrigger><TabsTrigger className={styles.typeTab} value="note" disabled={busy}><span className={styles.tabLabel}><SquarePen size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Note")}</span></TabsTrigger><TabsTrigger className={styles.typeTab} value="file" disabled={busy}><span className={styles.tabLabel}><FileUp size={16} strokeWidth={1.75} aria-hidden="true"/>{t("File")}</span></TabsTrigger></TabsList>{mode === "link" && !source && !platform && <div inert={busy || sourceLoading} aria-busy={sourceLoading || undefined}><DropdownMenu label={t("Import from")} icon={<Download size={16} strokeWidth={1.75} aria-hidden="true"/>} items={[...browsers.map(item => ({ label: item.browser, icon: <BrowserIcon browser={item.browser}/>, onSelect: () => { void readSource(item); } })), ...(services.openCaptureSite ? [{ label: t('Platforms'), content: <PlatformGroup/>, separatorBefore: browsers.length > 0, onSelect: () => { generation.current++; setPlatform(true); setError(''); } }] : []), ...(!browsers.length && !services.openCaptureSite ? [{ label: t(services.available() ? 'No browser profiles found' : 'Available in the desktop app'), disabled: true }] : [])]}/></div>}</div>
      {/* These forms grow after lookup/file selection. Mount only the selected
          documented forceMount panel so a tab-transition height cannot trap
          dynamically added fields inside the previous panel's short height.
          Link and Note keep drafts in this component; the file form is kept
          mounted but hidden (display: none adds no height). */}
      {mode === "link" && <TabsContent value="link" forceMount className={styles.importPanel}>
        {platform && services.openCaptureSite ? <BrowserCapturePanel services={services} onBack={() => setPlatform(null)}/> : source ? <div className={`${styles.fields} ${styles.importForm}`}>
          <div className={styles.previewHeading}><Button variant="ghost" size="sm" aria-label={t("Back to Link")} disabled={busy} onClick={() => { generation.current++; setReading(false); setSource(null); setError(''); }}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true"/></Button><BrowserIcon browser={source.browser}/><h3>{source.browser}</h3></div>
          <input ref={bookmarkInput} type="file" accept=".html,.htm,text/html" hidden aria-label={t("Choose bookmark file")} disabled={busy || reading} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (file) void readSource(source, file);
          }}/>
          {reading ? <Skeleton label={t("Reading bookmarks")} lines={4}/> : browserPhase === 'needsAccess' ? <p className={styles.status} role="status">{t('Click Read bookmarks, then click Open in the system window to allow access.')}</p>
            : browserPhase === 'unavailable' ? <p className={styles.status} role="status">{t('No local bookmarks were found for {browser}. You can import an exported bookmark HTML file.', { browser: source.browser })}</p> : error && !candidates.length ? null : <>
            <div className={styles.selection}><Checkbox label={t("Select all")} checked={selectedCount === 0 ? false : selectedCount === available.length ? true : 'indeterminate'} disabled={busy || !available.length} onCheckedChange={checked => setSelected(checked === true ? new Set(available.map(item => item.key)) : new Set())}/><span className={styles.counts} role="status">{t('{count} selected', { count: selectedCount })}</span></div>
            <div className={styles.bookmarks}><ul className={styles.list}>{candidates.slice(0, visibleCount).map(item => <li key={item.key} className={styles.bookmark}><Checkbox checked={selected.has(item.key) && !item.saved} disabled={busy || item.saved} aria-label={t('Select {title}', { title: item.title })} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked === true)
                next.add(item.key);
            else
                next.delete(item.key); return next; })}/><SiteFavicon candidates={faviconCandidates(item)} remoteFallback={!services.icons} label={new URL(item.url).hostname}/><div><span className={styles.bookmarkTitle} data-tooltip={item.title}>{item.title}</span><div className={styles.bookmarkSource}><span>{item.folderPath.length ? item.folderPath.join(' / ') : new URL(item.url).hostname}</span>{item.saved && <span className={styles.saved}><Check size={12} aria-hidden="true"/>{t("Saved")}</span>}</div></div></li>)}</ul>{candidates.length > visibleCount && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setVisibleCount(count => count + 100)}>{t("Show 100 more")}</Button>}{!candidates.length && !error && <p className={styles.status}>{t("No web bookmarks found")}</p>}</div>
          </>}
          <div className={styles.actions}><Button variant="secondary" disabled={busy || reading} onClick={() => {
            if (browserPhase === 'needsAccess') void readSource(source, undefined, true);
            else if (browserPhase === 'unavailable' || (!candidates.length && !error)) bookmarkInput.current?.click();
            else void readSource(source);
          }}>{browserPhase === 'needsAccess' ? t("Read bookmarks") : browserPhase === 'unavailable' || (!candidates.length && !error && !reading) ? t("Choose bookmark file") : <><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Refresh bookmarks")}</>}</Button><Button variant="primary" disabled={busy || reading || browserPhase !== 'ready' || !selectedCount} onClick={() => { try {
            const items = makeBrowserLinks(available.filter(item => selected.has(item.key)), source);
            const version = generation.current;
            // Links are saved at once; text and covers are read in the background
            // from one render of each page. Progress follows the actual saves.
            setProgress({ completed: 0, total: items.length });
            void save(items, false, undefined, completed => { if (generation.current === version) setProgress({ completed, total: items.length }); });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Links could not be imported.');
        } }}><Download size={16} strokeWidth={1.75} aria-hidden="true"/>{t(reading || browserPhase !== 'ready' ? 'Import links' : selectedCount === 1 ? 'Import {count} link' : 'Import {count} links', { count: selectedCount })}</Button></div>
        </div> : <>
          <form className={`${styles.fields} ${styles.importForm}`} onSubmit={event => { void submit(event); }}>
            <div className={styles.linkRow}>
            <Input label={t("Link")} value={url} maxLength={8192} error={t(urlError)} onBlur={() => setUrlError(url.trim() && !normalized ? 'Enter a complete http:// or https:// link.' : '')} onChange={event => {
                const value = event.target.value;
                let next = '';
                try { next = normalizeLink(value); } catch { /* Invalid input also supersedes an old lookup. */ }
                setUrl(value); setUrlError(''); setError('');
                if (next !== normalized) {
                    generation.current++;
                    lookupRequest.current = null;
                    edited.current = { title: false, content: false };
                    setTitle(''); setContent(''); setPreview(null); setLookupError('');
                    setLooking(Boolean(next && services.available()));
                }
            }} placeholder={t("Paste a link")} disabled={busy} autoComplete="url"/>
            {normalized && <Input label={t("Title")} value={title} maxLength={500} onChange={event => { edited.current.title = true; setTitle(event.target.value); }} placeholder={looking ? t("Reading title") + dots : new URL(normalized).hostname} aria-busy={looking || undefined} disabled={busy}/>}
            </div>
            {normalized && <>
              {looking && <span className="sr-only" role="status">{t("Reading page details…")}</span>}
              {lookupError && <div className={styles.entry}><p className={styles.status} role="status">{t(lookupError)}</p><Button type="button" variant="ghost" size="sm" disabled={looking || busy} onClick={() => { lookupRequest.current = null; setRetry(value => value + 1); }}>{t("Retry lookup")}</Button></div>}
              <Textarea label={t("Content")} rows={3} maxLength={50000} value={content} onChange={event => { edited.current.content = true; setContent(event.target.value); }} placeholder={looking ? t("Reading content") + dots : t("Add or edit the content for AI")} aria-busy={looking || undefined} disabled={busy}/>
              {coverField}
              {tagsField}
            </>}
            <div className={styles.actions}><Button type="submit" variant="primary" loading={busy} disabled={!normalized || coverReading}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Save link")}</Button></div>
          </form>
        </>}
      </TabsContent>}
      {mode === "note" && <TabsContent value="note" forceMount className={styles.importPanel}><form className={`${styles.fields} ${styles.importForm}`} onSubmit={event => { void submit(event); }}><Input label={t("Title")} value={title} onChange={event => setTitle(event.target.value)} maxLength={500} placeholder={t("Note title")} disabled={busy}/><Textarea label={t("Content")} value={content} onChange={event => setContent(event.target.value)} rows={3} maxLength={50000} placeholder={t("Write or paste a note")} disabled={busy}/>{coverField}{tagsField}<div className={styles.actions}><Button type="submit" variant="primary" loading={busy} disabled={!content.trim() || coverReading}>{t("Save note")}</Button></div></form></TabsContent>}
      {fileOpened && <TabsContent value="file" forceMount hidden={mode !== "file"} className={styles.importPanel}><ReferenceFileImport availableTags={availableTags} prepareCover={services.prepareCover} disabled={!services.available()} onBusy={setBusy} onSave={onImportFiles} onChoose={onChooseFiles} onSaveChosen={onImportChosenFiles} onAdded={async items => { await onAdd(items, true); onClose(); }} /></TabsContent>}
    </Tabs>
    <Alert className={styles.error} tone="danger" title={t("Import could not be completed")} open={Boolean(error)}>{t(error)}</Alert>
    <FluidDialog open={Boolean(replacing)} onClose={() => { if (!busy) setReplacing(null); }} busy={busy} title={t('Replace saved link?')}
      description={replacing?.title ? t('“{title}” is already in your library.', { title: replacing.title }) : t('This link is already in your library.')}>
      <p className={styles.replaceCopy}>{t('This will replace the saved reference with the current page.')}</p>
      <Alert tone="danger" title={t('Import could not be completed')} open={Boolean(replacing && error)}>{t(error)}</Alert>
      <div className={styles.replaceActions}>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setReplacing(null)}>{t('Keep existing')}</Button>
        <Button type="button" variant="primary" loading={busy} onClick={() => {
          const pending = replacing;
          if (!pending || !onReplace) return;
          void save([pending.item], false, pending.prepare, undefined, async items => { await onReplace(items[0]); setReplacing(null); });
        }}>{t('Replace link')}</Button>
      </div>
    </FluidDialog>
  </FluidDialog>;
}
