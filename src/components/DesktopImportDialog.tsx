import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
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
import { importReferenceFiles } from '../lib/storage';
import { ReferenceFileImport } from './ReferenceFileImport';
import type { FileReferencePayload } from '../lib/fileReference';
import { bookmarkCandidates, desktopLinkImport, makeBrowserLinks, makeLink, normalizeLink, type BrowserSource, type LinkImportService, type LinkPreview } from '../lib/linkImport';
import type { StashItem } from '../types';
import styles from './DesktopImportDialog.module.css';
import chromeIcon from '../assets/brands/chrome.svg?inline';
import edgeIcon from '../assets/brands/edge.svg?inline';
import firefoxIcon from '../assets/brands/firefox.svg?inline';
import { BrowserCapturePanel } from './BrowserCapturePanel';
import { ReferenceCoverField } from './ReferenceCoverField';
import { withReferenceCover, type ReferenceCover } from '../lib/referenceCover';

type Props = {
    open: boolean;
    onClose: () => void;
    onAdd: (items: StashItem[], persisted?: boolean) => Promise<void>;
    availableTags?: string[];
    existingItems?: StashItem[];
    services?: LinkImportService;
    onImportFiles?: (files: FileReferencePayload[], tags: string[]) => Promise<StashItem[]>;
};
type Candidate = ReturnType<typeof bookmarkCandidates>[number];
function BrowserIcon({ browser }: {
    browser: string;
}) { return <img className={styles.browserIcon} src={({ Chrome: chromeIcon, Edge: edgeIcon, Firefox: firefoxIcon } as Record<string, string>)[browser]} alt="" aria-hidden="true"/>; }
export function DesktopImportDialog({ open, onClose, onAdd, availableTags = [], existingItems = [], services = desktopLinkImport, onImportFiles = importReferenceFiles }: Props) {
  const { t } = useI18n();
    const [mode, setMode] = useState('link');
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [covers, setCovers] = useState<Record<string, ReferenceCover | null>>({});
    const [coverReading, setCoverReading] = useState(false);
    const [sources, setSources] = useState<BrowserSource[]>([]);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [source, setSource] = useState<BrowserSource | null>(null);
    const [platform, setPlatform] = useState<boolean | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState('');
    const [lookupError, setLookupError] = useState('');
    const [looking, setLooking] = useState(false);
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
    const iconView = useRef({ open, mode, sourceId: source?.id });
    iconView.current = { open, mode, sourceId: source?.id };
    const tagField = useRef<HTMLDivElement>(null);
    const currentTags = useRef<string[]>([]);
    let normalized = '';
    try {
        normalized = normalizeLink(url);
    }
    catch { /* Keep invalid input editable. */ }
    const reset = () => { setMode('link'); setPlatform(null); setUrl(''); setTitle(''); setContent(''); setTags([]); setCovers({}); setCoverReading(false); currentTags.current = []; setSource(null); setCandidates([]); setSelected(new Set()); setError(''); setUrlError(''); setLookupError(''); setPreview(null); drafts.current = {}; edited.current = { title: false, content: false }; };
    useEffect(() => {
        if (!open || !services.available())
            return;
        let current = true;
        setSourceLoading(true);
        services.sources().then(items => { if (current)
            setSources(items); }).catch(() => { if (current)
            setError('Browser profiles could not be found. Retry or add a link manually.'); }).finally(() => { if (current)
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
        const timer = setTimeout(() => {
            services.preview(normalized).then(result => {
                if (!current)
                    return;
                setPreview(result);
                if (!edited.current.title)
                    setTitle(result.title);
                if (!edited.current.content)
                    setContent(result.content);
            }).catch(reason => { if (current)
                setLookupError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'Could not read this page. You can enter its details manually.'); }).finally(() => { if (current)
                setLooking(false); });
        }, 650);
        return () => { current = false; clearTimeout(timer); };
    }, [open, mode, source, platform, normalized, services, retry]);
    useEffect(() => { if (!open)
        generation.current++; }, [open]);
    useEffect(() => {
        if (!open || mode !== 'link' || !source || reading || !services.icons) return;
        const urls = candidates.slice(0, visibleCount).filter(item => !normalizeFavicon(item.faviconUrl) && !attemptedIcons.current.has(item.url)).map(item => item.url);
        urls.forEach(url => attemptedIcons.current.add(url));
        const version = generation.current;
        // Read cached icons immediately; enrich only displayed missing rows, in
        // bounded batches. Both hosts use the same validated native rasterizer.
        void (async () => {
            for (let offset = 0; offset < urls.length; offset += 12) {
                if (version !== generation.current || !iconView.current.open || iconView.current.mode !== 'link' || iconView.current.sourceId !== source.id) return;
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
    }, [open, mode, source, reading, candidates, visibleCount, services]);
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
    const save = async (items: StashItem[], persisted = false) => {
        setBusy(true);
        setError('');
        try {
            await onAdd(items, persisted);
            onClose();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'References could not be saved. Try again.');
        }
        finally {
            setBusy(false);
        }
    };
    const readSource = async (next: BrowserSource) => {
        const version = ++generation.current;
        attemptedIcons.current.clear();
        setSource(next);
        setReading(true);
        setError('');
        setCandidates([]);
        setSelected(new Set());
        setVisibleCount(100);
        try {
            const profiles = sources.filter(item => item.browser === next.browser);
            const bookmarks = [];
            // Profiles can each contain a large collection. Read one at a time,
            // and stop scheduling work as soon as the user leaves this import.
            for (const profile of profiles.length ? profiles : [next]) {
                if (generation.current !== version) return;
                bookmarks.push(...await services.bookmarks(profile.id));
                if (bookmarks.length > 50_000) throw Error('This bookmark collection is too large to read in one import.');
            }
            if (generation.current !== version) return;
            const urls = await services.existingUrls?.() ?? [];
            const items = bookmarkCandidates(bookmarks, next, [...existingItems, ...urls.map(url => ({ url } as StashItem))]);
            if (generation.current !== version)
                return;
            setCandidates(items);
            setSelected(new Set(items.filter(item => !item.saved).map(item => item.key)));
        }
        catch (reason) {
            if (generation.current === version)
                setError(typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : 'Bookmarks could not be read. Retry the import.');
        }
        finally {
            if (generation.current === version)
                setReading(false);
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
                const existingUrls = await services.existingUrls?.() ?? [];
                if ([...existingItems, ...existingUrls.map(url => ({ url } as StashItem))].some(item => { try {
                    return item.url && normalizeLink(item.url) === normalizeLink(url);
                }
                catch {
                    return false;
                } })) {
                    setError('This link is already in your library.');
                    return;
                }
                const item = makeLink({ url, title, content, tags: values, faviconUrl: preview?.faviconUrl, preview: preview?.preview });
                if (item.origin && preview?.previewKind) item.origin.previewKind = preview.previewKind;
                await save([withReferenceCover(item, covers.link ?? null)]);
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
    const browsers = sources.filter((item, index) => sources.findIndex(other => other.browser === item.browser) === index);
    const selectedCount = available.filter(item => selected.has(item.key)).length;
    return <FluidDialog open={open} onClose={onClose} onExited={reset} busy={busy || coverReading} size="import" title={t("Import references")}>
    <Tabs className={styles.importTabs} value={mode} onValueChange={next => { if (busy || coverReading)
        return; drafts.current[mode] = { title, content }; generation.current++; setReading(false); setMode(next); setPlatform(null); setSource(null); setError(''); setTitle(drafts.current[next]?.title || ''); setContent(drafts.current[next]?.content || ''); setPreview(null); edited.current = { title: Boolean(drafts.current[next]?.title), content: Boolean(drafts.current[next]?.content) }; }}>
      <div className={styles.typeBar}><TabsList aria-label={t("Reference type")}><TabsTrigger className={styles.typeTab} value="link" disabled={busy}><span className={styles.tabLabel}><Link size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Link")}</span></TabsTrigger><TabsTrigger className={styles.typeTab} value="note" disabled={busy}><span className={styles.tabLabel}><SquarePen size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Note")}</span></TabsTrigger><TabsTrigger className={styles.typeTab} value="file" disabled={busy}><span className={styles.tabLabel}><FileUp size={16} strokeWidth={1.75} aria-hidden="true"/>{t("File")}</span></TabsTrigger></TabsList>{mode === "link" && !source && !platform && <div inert={busy || sourceLoading} aria-busy={sourceLoading || undefined}><DropdownMenu label={t("Import from")} icon={<Download size={16} strokeWidth={1.75} aria-hidden="true"/>} items={[...browsers.map(item => ({ label: item.browser, icon: <BrowserIcon browser={item.browser}/>, onSelect: () => { void readSource(item); } })), ...(services.openCaptureSite ? [{ label: t('Platforms'), content: <PlatformGroup/>, separatorBefore: browsers.length > 0, onSelect: () => { generation.current++; setPlatform(true); setError(''); } }] : []), ...(!browsers.length && !services.openCaptureSite ? [{ label: t(services.available() ? 'No browser profiles found' : 'Available in the desktop app'), disabled: true }] : [])]}/></div>}</div>
      {/* These forms grow after lookup/file selection. Mount only the selected
          documented forceMount panel so a tab-transition height cannot trap
          dynamically added fields inside the previous panel's short height. */}
      {mode === "link" && <TabsContent value="link" forceMount className={styles.importPanel}>
        {platform && services.openCaptureSite ? <BrowserCapturePanel services={services} onBack={() => setPlatform(null)}/> : source ? <div className={`${styles.fields} ${styles.importForm}`}>
          <div className={styles.previewHeading}><Button variant="ghost" size="sm" aria-label={t("Back to Link")} disabled={busy} onClick={() => { generation.current++; setReading(false); setSource(null); setError(''); }}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true"/></Button><BrowserIcon browser={source.browser}/><h3>{source.browser}</h3></div>
          {reading ? <Skeleton label={t("Reading bookmarks")} lines={4}/> : <>
            <div className={styles.selection}><Checkbox label={t("Select all")} checked={selectedCount === 0 ? false : selectedCount === available.length ? true : 'indeterminate'} disabled={busy || !available.length} onCheckedChange={checked => setSelected(checked === true ? new Set(available.map(item => item.key)) : new Set())}/><span className={styles.counts} role="status">{t('{count} selected', { count: selectedCount })}</span></div>
            <div className={styles.bookmarks}><ul className={styles.list}>{candidates.slice(0, visibleCount).map(item => <li key={item.key} className={styles.bookmark}><Checkbox checked={selected.has(item.key) && !item.saved} disabled={busy || item.saved} aria-label={t('Select {title}', { title: item.title })} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked === true)
                next.add(item.key);
            else
                next.delete(item.key); return next; })}/><SiteFavicon candidates={faviconCandidates(item)} remoteFallback={!services.icons} label={new URL(item.url).hostname}/><div><span className={styles.bookmarkTitle} data-tooltip={item.title}>{item.title}</span><div className={styles.bookmarkSource}><span>{item.folderPath.length ? item.folderPath.join(' / ') : new URL(item.url).hostname}</span>{item.saved && <span className={styles.saved}><Check size={12} aria-hidden="true"/>{t("Saved")}</span>}</div></div></li>)}</ul>{candidates.length > visibleCount && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setVisibleCount(count => count + 100)}>{t("Show 100 more")}</Button>}{!candidates.length && <p className={styles.status}>{t("No web bookmarks found")}</p>}</div>
          </>}
          <div className={styles.actions}><Button variant="secondary" disabled={busy || reading} onClick={() => void readSource(source)}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Refresh bookmarks")}</Button><Button variant="primary" loading={busy} disabled={reading || !selectedCount} onClick={() => { try {
            void save(makeBrowserLinks(available.filter(item => selected.has(item.key)), source));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Links could not be imported.');
        } }}><Download size={16} strokeWidth={1.75} aria-hidden="true"/>{t(selectedCount === 1 ? 'Import {count} link' : 'Import {count} links', { count: selectedCount })}</Button></div>
        </div> : <>
          <form className={`${styles.fields} ${styles.importForm}`} onSubmit={event => { void submit(event); }}>
            <div className={styles.linkRow}>
            <Input label={t("Link")} value={url} maxLength={8192} error={t(urlError)} onBlur={() => setUrlError(url.trim() && !normalized ? 'Enter a complete http:// or https:// link.' : '')} onChange={event => { setUrl(event.target.value); setUrlError(''); setPreview(null); setLookupError(''); setError(''); if (!edited.current.title)
            setTitle(''); if (!edited.current.content)
            setContent(''); }} placeholder={t("Paste a link")} disabled={busy} autoComplete="url"/>
            {normalized && <Input label={t("Title")} value={title} maxLength={500} onChange={event => { edited.current.title = true; setTitle(event.target.value); }} placeholder={looking ? t("Reading title…") : new URL(normalized).hostname} disabled={busy}/>}
            </div>
            {normalized && <>
              {looking && <span className="sr-only" role="status">{t("Reading page details…")}</span>}
              {lookupError && <div className={styles.entry}><p className={styles.status} role="status">{t(lookupError)}</p><Button type="button" variant="ghost" size="sm" disabled={looking || busy} onClick={() => setRetry(value => value + 1)}>{t("Retry lookup")}</Button></div>}
              <Textarea label={t("Content")} rows={3} maxLength={50000} value={content} onChange={event => { edited.current.content = true; setContent(event.target.value); }} placeholder={t("Add or edit the content for AI")} disabled={busy}/>
              {coverField}
              {tagsField}
            </>}
            <div className={styles.actions}><Button type="submit" variant="primary" loading={busy} disabled={!normalized || coverReading}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>{t("Save link")}</Button></div>
          </form>
        </>}
      </TabsContent>}
      {mode === "note" && <TabsContent value="note" forceMount className={styles.importPanel}><form className={`${styles.fields} ${styles.importForm}`} onSubmit={event => { void submit(event); }}><Input label={t("Title")} value={title} onChange={event => setTitle(event.target.value)} maxLength={500} placeholder={t("Note title")} disabled={busy}/><Textarea label={t("Content")} value={content} onChange={event => setContent(event.target.value)} rows={3} maxLength={50000} placeholder={t("Write or paste a note")} disabled={busy}/>{coverField}{tagsField}<div className={styles.actions}><Button type="submit" variant="primary" loading={busy} disabled={!content.trim() || coverReading}>{t("Save note")}</Button></div></form></TabsContent>}
      {mode === "file" && <TabsContent value="file" forceMount className={styles.importPanel}><ReferenceFileImport availableTags={availableTags} prepareCover={services.prepareCover} disabled={!services.available()} onBusy={setBusy} onSave={onImportFiles} onAdded={async items => { await onAdd(items, true); onClose(); }} /></TabsContent>}
    </Tabs>
    <Alert className={styles.error} tone="danger" title={t("Import could not be completed")} open={Boolean(error)}>{t(error)}</Alert>
  </FluidDialog>;
}
