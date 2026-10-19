import { useI18n } from '../features/settings/locale';
import { useEffect, useRef, useState } from 'react';
import { FileUpload, type FileUploadItem } from './arc/file-upload/file-upload';
import { Button } from './arc/button/button';
import { Input } from './arc/input/input';
import { Textarea } from './arc/textarea/textarea';
import { Alert } from './arc/alert/alert';
import { DropdownMenu } from './arc/dropdown-menu/dropdown-menu';
import { ReferenceTagsField } from './ReferenceTagsField';
import { ReferenceGlyph } from './ReferenceVisual';
import { cleanReferenceTags } from '../features/library/store';
import { FILE_REFERENCE_LIMIT, fileReferencePayload, fileReferenceType, stageFileContent, type FileReferencePayload } from '../lib/fileReference';
import type { StashItem } from '../types';
import styles from './DesktopImportDialog.module.css';
import { ReferenceCoverField } from './ReferenceCoverField';
import type { PrepareReferenceCover, ReferenceCover } from '../lib/referenceCover';

type Draft = { file: File; title: string; content: string; cover?: ReferenceCover | null };

export function ReferenceFileImport({ availableTags, disabled, onBusy, onSave, onAdded, prepareCover }: {
  availableTags: string[]; disabled: boolean; onBusy: (busy: boolean) => void;
  onSave: (files: FileReferencePayload[], tags: string[]) => Promise<StashItem[]>;
  onAdded: (items: StashItem[]) => Promise<void>;
  prepareCover?: PrepareReferenceCover;
}) {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileUploadItem[]>([]), [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]), [active, setActive] = useState(0), [tags, setTags] = useState<string[]>([]);
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false), [replacing, setReplacing] = useState(false), [error, setError] = useState('');
  const [coverReading, setCoverReading] = useState(false);
  const generation = useRef(0), tagField = useRef<HTMLDivElement>(null), savedItems = useRef<StashItem[] | null>(null);
  useEffect(() => () => { generation.current++; }, []);
  const choose = (next: FileUploadItem[]) => {
    if (coverReading) return;
    const version = ++generation.current; setFiles(next); savedItems.current = null; setError('');
    if (!next.length || next.some(item => item.error)) { setFile(null); setDrafts([]); setReading(false); return; }
    if (next.length > 10 || next.reduce((sum, item) => sum + item.file.size, 0) > 10000000) { setFile(null); setDrafts([]); setReading(false); setError('Choose up to 10 files, 10 MB in total.'); return; }
    const initial = next.map(item => ({ file: item.file, title: item.file.name, content: '' }));
    setFile(initial[0].file); setDrafts(initial); setActive(0); setReplacing(false); setReading(true);
    void Promise.all(initial.map(async draft => ({ ...draft, content: await stageFileContent(draft.file) }))).then(value => { if (generation.current === version) setDrafts(value); })
      .catch(reason => { if (generation.current === version) setError(reason instanceof Error ? reason.message : 'The file could not be read. Choose it again.'); })
      .finally(() => { if (generation.current === version) setReading(false); });
  };
  const identity = file ? fileReferenceType({ kind: 'file', title: file.name, mimeType: file.type }) : null;
  return <div className={`${styles.fields} ${styles.fileFlow}`}>
    {!file || replacing ? <FileUpload showBrowse={false} value={replacing ? [] : files} onChange={choose} multiple maxSize={FILE_REFERENCE_LIMIT} disabled={disabled || busy || coverReading} label={t("Choose files")} description={t("Drop files here, up to 5 MB each.")} />
      : <div className={styles.fileHeading}>{identity && <ReferenceGlyph kind={identity.visual} size={20} />}<span data-tooltip={file.name}>{file.name}</span>{drafts.length > 1 && <DropdownMenu label={t("Edit file")} items={drafts.map((draft, index) => ({ label: draft.file.name, disabled: busy || reading || coverReading || Boolean(savedItems.current), onSelect: () => { setActive(index); setFile(draft.file); } }))} />}<Button type="button" variant="secondary" size="sm" disabled={busy || coverReading} onClick={() => setReplacing(true)}>{t("Replace files")}</Button></div>}
    {file && !replacing && <form className={`${styles.fields} ${styles.importForm}`} onSubmit={event => {
      event.preventDefault(); if (busy || reading || coverReading || disabled) return;
      setBusy(true); onBusy(true); setError('');
      void (async () => {
        const draft = tagField.current?.querySelector('input')?.value.trim() || '';
        const canonical = availableTags.find(name => name.toLowerCase() === draft.toLowerCase()) ?? draft;
        const values = cleanReferenceTags(canonical && !tags.some(name => name.toLowerCase() === canonical.toLowerCase()) ? [...tags, canonical] : tags);
        // A refresh failure after persistence must not save a second file on Retry.
        savedItems.current ??= await onSave(await Promise.all(drafts.map(async draft => ({ ...await fileReferencePayload(draft.file, draft.title, draft.content), ...(draft.cover ? { preview: draft.cover.preview } : {}) }))), values);
        await onAdded(savedItems.current);
      })().catch(reason => setError(reason instanceof Error ? reason.message : 'The file could not be saved. Retry.'))
        .finally(() => { setBusy(false); onBusy(false); });
    }}>
      <Input label={t("Title")} value={drafts[active]?.title ?? ''} maxLength={500} required disabled={busy || reading || Boolean(savedItems.current)} onChange={event => setDrafts(current => current.map((draft, index) => index === active ? { ...draft, title: event.target.value } : draft))} />
      <Textarea label={t("Content")} value={drafts[active]?.content ?? ''} rows={3} maxLength={50000} disabled={busy || reading || Boolean(savedItems.current)} placeholder={t("Add or edit the content for AI")} onChange={event => setDrafts(current => current.map((draft, index) => index === active ? { ...draft, content: event.target.value } : draft))} />
      {prepareCover && <ReferenceCoverField key={active} value={drafts[active]?.cover ?? null} prepare={prepareCover} disabled={busy || reading || Boolean(savedItems.current)} onPreparing={next => { setCoverReading(next); onBusy(next); }} onChange={cover => setDrafts(current => current.map((draft, index) => index === active ? { ...draft, cover } : draft))} />}
      <ReferenceTagsField value={tags} onValueChange={setTags} availableTags={availableTags} fieldRef={tagField} busy={busy || reading || Boolean(savedItems.current)} />
      <div className={styles.actions}><Button type="submit" variant="primary" loading={busy || reading} disabled={disabled || coverReading || drafts.some(draft => !draft.title.trim())}>{drafts.length > 1 ? t("Save files") : t("Save file")}</Button></div>
    </form>}
    {(!file || replacing) && <div className={styles.actions}><Button type="button" variant="primary" disabled>{t("Save file")}</Button></div>}
    {error && <Alert tone="danger" title={t("File could not be saved")}>{t(error)}</Alert>}
  </div>;
}
