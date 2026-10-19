import { useRef, useState, type FocusEvent } from 'react';
import { motion } from 'motion/react';
import { motionTokens } from './arc/lib/motion-tokens';
import { useReducedMotionPreference } from '../lib/useReducedMotionPreference';
import styles from './arc/dropdown-menu/dropdown-menu.module.css';

// Shared Arc presentation for action menus and selectable filter menus.
export function useMenuHighlight() {
  const [target, setTarget] = useState<{ y: number; height: number; danger: boolean } | null>(null);
  const reduced = useReducedMotionPreference();
  const pointer = useRef(false);
  const focus = (event: FocusEvent<HTMLDivElement>) => {
    // React focus events also bubble through portals. A nested action menu
    // must not reposition the parent filter's highlight.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>('[role^="menuitem"]');
    setTarget(item ? { y: item.offsetTop, height: item.offsetHeight, danger: item.dataset.tone === 'danger' } : null);
  };
  return {
    reset: () => setTarget(null),
    events: { onFocus: focus, onPointerMoveCapture: () => { pointer.current = true; }, onKeyDownCapture: () => { pointer.current = false; } },
    highlight: <motion.span className={styles.highlight} aria-hidden="true" data-menu-highlight data-tone={target?.danger ? 'danger' : undefined}
      initial={false} animate={target ? { y: target.y, height: target.height, opacity: 1 } : { opacity: 0 }}
      transition={reduced || !pointer.current ? { duration: 0 } : motionTokens.spring.smooth} />,
  };
}
