import { useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown, Plus } from 'lucide-react';
import { Input } from './arc/input/input';
import { Button } from './arc/button/button';
import { Popover, PopoverTrigger } from './arc/popover/popover';
import { ScrollArea } from './arc/scroll-area/scroll-area';
import popoverStyles from './arc/popover/popover.module.css';
import styles from './DesktopTagPicker.module.css';

type Props = { tags: string[]; availableTags: string[]; draft: string; disabled: boolean; onDraftChange: (value: string) => void; onAdd: (value: string) => void };

// Arc Input + Popover composition. The platform adapter changes only the portal
// destination/collision bounds: the menu stays within its native host.
export function DesktopTagPicker({ tags, availableTags, draft, disabled, onDraftChange, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [side, setSide] = useState<'right' | 'left' | 'bottom'>('right');
  const input = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const candidate = draft.trim();
  const remaining = availableTags.filter(name => !tags.some(tag => tag.toLowerCase() === name.toLowerCase()));
  const choices = remaining.filter(name => name.toLowerCase().includes(candidate.toLowerCase()));
  const create = candidate && ![...availableTags, ...tags].some(tag => tag.toLowerCase() === candidate.toLowerCase());
  const add = (name: string) => { onAdd(availableTags.find(tag => tag.toLowerCase() === name.toLowerCase()) ?? name); setOpen(false); };
  const changeOpen = (next: boolean) => {
    if (next) {
      const pane = document.querySelector<HTMLElement>('.desktop-panel');
      setHost(pane);
      const anchor = field.current?.getBoundingClientRect();
      const bounds = pane?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth, width: window.innerWidth };
      const scale = pane ? bounds.width / pane.offsetWidth : 1;
      const room = (224 + 40 + 12) * scale;
      // Radix flips within an axis. Choose a vertical axis first when neither
      // side can fit the picker, then let collision handling choose top/bottom.
      setSide(anchor && bounds.right - anchor.right >= room ? 'right' : anchor && anchor.left - bounds.left >= room ? 'left' : 'bottom');
    }
    setOpen(next);
  };
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverPrimitive.Anchor asChild><div ref={field} className={styles.field} data-tag-picker>
      <Input ref={input} label="Add tag" placeholder="Type a tag" value={draft} className={styles.input} disabled={disabled}
        onChange={event => onDraftChange(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (candidate) add(candidate); }
          if (event.key === 'ArrowDown') { event.preventDefault(); changeOpen(true); }
        }} />
      <PopoverTrigger asChild><Button className={styles.trigger} type="button" variant="ghost" disabled={disabled} aria-label="Choose tags"><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></Button></PopoverTrigger>
    </div></PopoverPrimitive.Anchor>
    <PopoverPrimitive.Portal container={host ?? undefined}>
      <PopoverPrimitive.Content data-arc-ui data-tag-picker aria-label="Choose tags" className={`${popoverStyles.content} ${styles.panel}`}
        side={side} align="end" sideOffset={side === 'bottom' ? 8 : 40} collisionBoundary={host} collisionPadding={12}
        onEscapeKeyDown={event => event.stopPropagation()}
        onCloseAutoFocus={event => { event.preventDefault(); if (input.current?.isConnected) input.current.focus(); }}>
        <ScrollArea label="Available tags" fade={0} maxHeight="min(280px, calc(var(--radix-popover-content-available-height) - 32px))">
          <div className={styles.choices}>
            {choices.map(name => <Button key={name} type="button" variant="ghost" className={styles.option} disabled={disabled || tags.length >= 12} onClick={() => add(name)}><span className={styles.optionText}>{name}</span></Button>)}
            {create && <Button type="button" variant="ghost" className={styles.option} disabled={disabled || candidate.length > 48 || tags.length >= 12} onClick={() => add(candidate)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.optionText}>Create “{candidate}”</span></Button>}
            {!choices.length && !create && <span className={styles.empty} role="status">No matching tags</span>}
          </div>
        </ScrollArea>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </Popover>;
}
