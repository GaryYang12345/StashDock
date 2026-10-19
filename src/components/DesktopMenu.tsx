import { useState, useRef, useEffect, useId, type ReactNode } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Context from '@radix-ui/react-context-menu';
import { useMenuHighlight } from './useMenuHighlight';
import styles from './arc/dropdown-menu/dropdown-menu.module.css';
import { useI18n } from '../features/settings/locale';

type Action = { label: string; icon: ReactNode; onSelect: () => void; destructive?: boolean };
type Props = { label: string; actions: Action[]; children: ReactNode; context?: boolean; portalContainer?: React.RefObject<HTMLElement | null>; onOpenChange?: (open: boolean) => void };

// Native platform adapter: Arc's stock triggers are labelled, and its context
// target also handles ordinary clicks. These surfaces need a custom trigger,
// and collisions must use the visible pane, not the native viewport.
// Reuse Arc's menu presentation/motion; Radix owns keyboard/focus/dismissal.
export function DesktopMenu({ label, actions, children, context = false, portalContainer, onOpenChange: notifyOpen }: Props) {
  const { t } = useI18n();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const callback = useRef(notifyOpen);
  callback.current = notifyOpen;
  const openRef = useRef(false);
  const [contextGeneration, setContextGeneration] = useState(0);
  const superseded = useRef(false);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id || !openRef.current) return;
      superseded.current = true; openRef.current = false; setOpen(false); callback.current?.(false);
      // Radix Context.Root is uncontrolled. Reset its internal open state as
      // well, otherwise a superseded tag menu can remain mounted and inert.
      if (context) setContextGeneration(value => value + 1);
    };
    window.addEventListener('stashdock:menu-open', dismiss);
    return () => window.removeEventListener('stashdock:menu-open', dismiss);
  }, [id, context]);
  const hover = useMenuHighlight();
  const onOpenChange = (open: boolean) => {
    openRef.current = open;
    setOpen(open);
    if (open) { superseded.current = false; window.dispatchEvent(new CustomEvent('stashdock:menu-open', { detail: id })); }
    callback.current?.(open);
    hover.reset();
    if (open) setHost(portalContainer?.current ?? document.querySelector<HTMLElement>('.desktop-panel'));
  };
  const highlight = hover.highlight;
  const shared = { className: styles.menu, inert: !open, 'aria-hidden': !open || undefined, collisionBoundary: host, collisionPadding: 12, loop: true, ...hover.events, 'aria-label': label };
  if (context) return <Context.Root modal={false} key={contextGeneration} onOpenChange={onOpenChange}>
    <Context.Trigger asChild>{children}</Context.Trigger>
    <Context.Portal container={host ?? undefined}><Context.Content {...shared} onCloseAutoFocus={event => {
      // Let Radix distinguish Escape from outside interaction. Forcing focus
      // back on every close can immediately dismiss a replacement menu.
      if (superseded.current || document.querySelector('[role="dialog"]')) event.preventDefault();
    }}>{highlight}
      {actions.map(action => <Context.Item key={action.label} className={`${styles.item} ${action.destructive ? styles.destructive : ''}`} data-tone={action.destructive ? 'danger' : undefined} onSelect={action.onSelect}><span className={styles.icon} aria-hidden="true">{action.icon}</span>{t(action.label)}</Context.Item>)}
    </Context.Content></Context.Portal>
  </Context.Root>;
  return <Dropdown.Root modal={false} open={open} onOpenChange={onOpenChange}>
    <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
    <Dropdown.Portal container={host ?? undefined}><Dropdown.Content {...shared} sideOffset={8} align="end" onCloseAutoFocus={event => { if (superseded.current || document.querySelector('[role="dialog"]')) event.preventDefault(); }}>{highlight}
      {actions.map(action => <Dropdown.Item key={action.label} className={`${styles.item} ${action.destructive ? styles.destructive : ''}`} data-tone={action.destructive ? 'danger' : undefined} onSelect={action.onSelect}><span className={styles.icon} aria-hidden="true">{action.icon}</span>{t(action.label)}</Dropdown.Item>)}
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>;
}
