import { useEffect, useRef, useState } from 'react';
import { Tag, Trash2, Check, Plus } from 'lucide-react';
import { FluidDialog } from '../../components/FluidDialog';
import { Button } from '../../components/arc/button/button';
import { DestructiveButton } from '../../components/DestructiveButton';
import { Input } from '../../components/arc/input/input';
import { Alert } from '../../components/arc/alert/alert';
import { ScrollArea } from '../../components/arc/scroll-area/scroll-area';
import { TagInput } from '../../components/arc/tag-input/tag-input';
import { cleanReferenceTags } from '../library/store';
import styles from './McpShelf.module.css';

export type ShelfTag = { name: string; count: number };
type Props = { open: boolean; tags: ShelfTag[]; selected: string[]; initialTags: string[]; onClose: () => void;
  onSave: (tags: string[]) => Promise<void>; onRename: (name: string, replacement: string) => Promise<void>; onDelete: (name: string) => Promise<void>; onFilter: (name: string) => void };
export function TagsDialog({ open, tags, selected, initialTags, onClose, onSave, onRename, onDelete, onFilter }: Props) {
  const [value, setValue] = useState(initialTags);
  const tagField = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [replacement, setReplacement] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (open) { setValue(initialTags); setRenaming(null); setRemoving(null); setError(''); setSaved(false); }
    // Capture the current reference tags when the dialog opens, not on each
    // background refresh, which would overwrite the user's in-progress edits.
  }, [open]);
  async function commit(callback: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setSaved(false);
    try { await callback(); setRenaming(null); setRemoving(null); setSaved(true); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Tags could not be saved. Retry.'); }
    finally { setBusy(false); }
  }
  return <FluidDialog open={open} busy={busy} onClose={onClose} title="Manage tags">
    <div className={styles.tagForm}>
      {selected.length > 0 && <form className={styles.tagForm} onSubmit={event => { event.preventDefault(); void commit(() => {
        const draft = tagField.current?.querySelector('input')?.value.trim();
        return onSave(cleanReferenceTags(draft && !value.some(tag => tag.toLowerCase() === draft.toLowerCase()) ? [...value, draft] : value));
      }); }}>
        <div ref={tagField} inert={busy} onKeyDownCapture={event => { if (event.target instanceof HTMLInputElement && (event.key === ',' || event.nativeEvent.isComposing)) event.stopPropagation(); }}><TagInput label="Tags" description="Press Enter to add a tag" placeholder="Add a tag" value={value} onValueChange={setValue} /></div>
        <div className={styles.tagSuggestions} role="group" aria-label="Existing tags">{tags.map(tag => {
          const added = value.some(name => name.toLowerCase() === tag.name.toLowerCase());
          return <Button key={tag.name} variant="secondary" size="sm" type="button" disabled={busy || added || value.length >= 12} onClick={() => setValue(current => [...current, tag.name])} aria-label={`Add tag ${tag.name}`}>{tag.name}{added ? <Check size={16} /> : <Plus size={16} />}</Button>;
        })}</div>
        <Button variant="primary" type="submit" loading={busy}>Save tags</Button>
      </form>}
      <ScrollArea label="Library tags" className={styles.tagList} fade={0}>
        {tags.length ? tags.map(tag => <div className={styles.tagRow} key={tag.name}>
          {renaming === tag.name ? <form className={styles.tagForm} onSubmit={event => { event.preventDefault(); void commit(() => onRename(tag.name, replacement)); }}><Input label={`Rename ${tag.name}`} value={replacement} onChange={event => setReplacement(event.target.value)} required maxLength={48} disabled={busy} /><div className={styles.tagActions}><Button type="button" variant="ghost" disabled={busy} onClick={() => setRenaming(null)}>Cancel rename</Button><Button type="submit" variant="primary" loading={busy}>Save name</Button></div></form>
            : <><Button variant="ghost" size="sm" className={styles.tagName} disabled={busy} aria-label={`Filter by ${tag.name}`} onClick={() => { onFilter(tag.name); onClose(); }}><Tag size={16} strokeWidth={1.75} aria-hidden="true" />{tag.name}<span className={styles.count}>{tag.count}</span></Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setRenaming(tag.name); setReplacement(tag.name); setRemoving(null); }}>Rename</Button><Button variant="ghost" size="sm" disabled={busy} aria-label={`Remove tag ${tag.name}`} onClick={() => { setRemoving(tag.name); setRenaming(null); }}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button></>}
          {removing === tag.name && <div className={styles.tagConfirmation}><p>Remove “{tag.name}” from all references?</p><div className={styles.tagActions}><Button variant="ghost" size="sm" disabled={busy} onClick={() => setRemoving(null)}>Keep tag</Button><DestructiveButton size="sm" loading={busy} onClick={() => void commit(() => onDelete(tag.name))}>Remove tag</DestructiveButton></div></div>}
        </div>) : <p>No tags yet. Add tags when importing or selecting references.</p>}
      </ScrollArea>
      {saved && <p role="status">Tags saved</p>}
      {error && <Alert tone="danger" title="Tags could not be saved">{error}</Alert>}
    </div>
  </FluidDialog>;
}
