import { useI18n } from '../features/settings/locale';
import { useId, useState, type RefObject } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { TagInput } from './arc/tag-input/tag-input';
import { Button } from './arc/button/button';
import { Popover, PopoverTrigger } from './arc/popover/popover';
import { ScrollArea } from './arc/scroll-area/scroll-area';
import { Input } from './arc/input/input';
import styles from './ReferenceTagsField.module.css';
import popoverStyles from './arc/popover/popover.module.css';

// All reference forms share this picker. Typing never opens the existing-tag list.
export function ReferenceTagsField({ value, onValueChange, availableTags, fieldRef, busy = false, onInput }: {
  value: string[]; onValueChange: (next: string[]) => void; availableTags: string[];
  fieldRef: RefObject<HTMLDivElement | null>; busy?: boolean; onInput?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [host, setHost] = useState<HTMLElement | null>(null);
  const inputId = useId();
  const suggestions = availableTags.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={styles.field} inert={busy}>
    <div className={styles.header}><label htmlFor={inputId}>{t("Tags")}</label>
    {availableTags.length > 0 && <div className={styles.picker}>
      <Popover open={open && !busy} onOpenChange={next => {
        // The transparent desktop HWND is larger than the visible, scaled pane.
        // Use the same platform portal adapter as FluidDialog/DesktopTagPicker.
        if (next) setHost(fieldRef.current?.closest<HTMLElement>('.desktop-panel') ?? null);
        setOpen(next); if (!next) setQuery('');
      }}>
        <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" disabled={busy}>{t("Choose tags")}<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></Button></PopoverTrigger>
        <PopoverPrimitive.Portal container={host ?? undefined}>
        <PopoverPrimitive.Content data-arc-ui className={`${popoverStyles.content} ${styles.surface}`} aria-label={t("Choose existing tags")} side="top" align="end" sideOffset={8}
          collisionBoundary={host} collisionPadding={16} sticky="always" onEscapeKeyDown={event => event.stopPropagation()}>
          <div className={styles.panel}>
            {availableTags.length > 12 && <Input label={t("Find tags")} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />}
            <ScrollArea maxHeight={`min(240px, max(0px, calc(var(--radix-popover-content-available-height, 320px) - ${availableTags.length > 12 ? 120 : 36}px)))`} label={t("Existing tags")} fade={0}>
              <div className={styles.suggestions} role="group" aria-label={t("Existing tags")}>{suggestions.map(name => {
                const added = value.some(tag => tag.toLowerCase() === name.toLowerCase());
                return <Button key={name} variant="secondary" size="sm" type="button" disabled={added || value.length >= 12} aria-label={t('Add tag {name}', { name })} onClick={() => onValueChange([...value, name])}><span className={styles.tagText} data-tooltip={name}>{name}</span>{added ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}</Button>;
              })}{!suggestions.length && <p className={styles.empty}>{t("No matching tags")}</p>}</div>
            </ScrollArea>
          </div>
        </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </Popover>
    </div>}</div>
    <div className={styles.input} ref={fieldRef} onInput={onInput} onKeyDownCapture={event => {
      if (event.target instanceof HTMLInputElement && (event.key === ',' || event.nativeEvent.isComposing)) event.stopPropagation();
    }}><TagInput id={inputId} label="" value={value} onValueChange={onValueChange} placeholder={t("Add a tag")} description={t("Press Enter to add a tag")} /></div>
  </div>;
}
