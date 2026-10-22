import { useI18n } from '../features/settings/locale';
import { memo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { Check, ChevronDown, Pin, PinOff, Tag } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Button } from './arc/button/button';
import { ScrollArea } from './arc/scroll-area/scroll-area';
import { DesktopMenu } from './DesktopMenu';
import { useMenuHighlight } from './useMenuHighlight';
import menu from './arc/dropdown-menu/dropdown-menu.module.css';
import { tagEditActions } from './referenceActions';
import type { TagOperation } from './TagEditor';
import styles from './ShelfTagFilter.module.css';

export type ShelfTag = { name: string; count: number };
export const ShelfTagFilter = memo(function ShelfTagFilter({ tags, activeTag, disabled, busy, triggerRef, onFilter, onEdit, pinnedTags = [], onPin }: {
  tags: ShelfTag[]; activeTag: string; disabled: boolean; busy: boolean;
  triggerRef: RefObject<HTMLElement | null>; onFilter: (name: string) => void; onEdit: (operation: TagOperation) => void;
  pinnedTags?: string[]; onPin?: (name: string, pinned: boolean) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const contextMenus = useRef(new Set<string>());
  // Radix parent items normally focus the parent menu on pointer leave.
  // Crossing into an independently portalled child must not steal its focus.
  const keepContextFocus = (event: PointerEvent<HTMLDivElement>) => {
    if (contextMenus.current.size) event.preventDefault();
  };
  const hover = useMenuHighlight();
  const edit = (operation: TagOperation) => { setOpen(false); onEdit(operation); };
  const actions = (name: string) => [
    ...(onPin ? [{ label: pinnedTags.includes(name) ? 'Unpin tag' : 'Pin tag', icon: pinnedTags.includes(name) ? <PinOff size={16} strokeWidth={1.75} /> : <Pin size={16} strokeWidth={1.75} />, onSelect: () => { if (!busy) onPin(name, !pinnedTags.includes(name)); } }] : []),
    ...tagEditActions(() => { if (!busy) edit({ name, action: 'rename' }); }, () => { if (!busy) edit({ name, action: 'remove' }); }),
  ];
  return <Dropdown.Root modal={false} open={open} onOpenChange={value => { setOpen(value); contextMenus.current.clear(); hover.reset(); }}>
    <Dropdown.Trigger asChild><Button ref={node => { triggerRef.current = node; }} variant="secondary" size="sm" disabled={disabled}>
      <Tag size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.tagLabel}>{activeTag || t("Tags")}</span><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
    </Button></Dropdown.Trigger>
    <Dropdown.Portal><Dropdown.Content align="end" sideOffset={8} collisionPadding={12} loop className={`${menu.menu} ${styles.tagPanel}`} aria-label={t("Tags")}
      onCloseAutoFocus={event => { if (document.querySelector('[role="dialog"]')) event.preventDefault(); }}>
      <ScrollArea label={t("Library tags")} maxHeight="min(50dvh, 320px)" fade={0}>
        <div className={styles.tagChoices} {...hover.events}>{hover.highlight}
        <Dropdown.RadioGroup value={activeTag}>
        <Dropdown.RadioItem value="" className={menu.item} disabled={busy} onPointerMove={keepContextFocus} onPointerLeave={keepContextFocus} onSelect={() => { onFilter(''); setOpen(false); }}>
          <span className={styles.tagLabel}>{t("All tags")}</span>{!activeTag && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
        </Dropdown.RadioItem>
        {tags.map(tag => <DesktopMenu key={tag.name} context onOpenChange={value => { if (value) contextMenus.current.add(tag.name); else contextMenus.current.delete(tag.name); }} label={t('Actions for tag {name}', { name: tag.name })} actions={actions(tag.name)}><div><Dropdown.RadioItem value={tag.name} disabled={busy} className={menu.item} onPointerMove={keepContextFocus} onPointerLeave={keepContextFocus} aria-label={t('Filter by {name}', { name: tag.name })} onSelect={() => { onFilter(tag.name); setOpen(false); }}>
          <span className={menu.icon}><Tag size={16} strokeWidth={1.75} aria-hidden="true" /></span><span className={styles.tagLabel}>{tag.name}</span><span className={styles.count}>{tag.count}</span>
          {activeTag === tag.name && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
        </Dropdown.RadioItem></div></DesktopMenu>)}
        </Dropdown.RadioGroup></div>
      </ScrollArea>
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>;
});
