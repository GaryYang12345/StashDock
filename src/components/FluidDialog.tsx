import { useI18n } from '../features/settings/locale';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type TargetAndTransition, type Transition } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog } from "./arc/dialog/dialog";
import { Button } from "./arc/button/button";
import { motionTokens } from "./arc/lib/motion-tokens";
import styles from "./FluidDialog.module.css";

type FluidDialogProps = { open: boolean; onClose: () => void; onExited?: () => void; title: string; description?: string; busy?: boolean; progress?: ReactNode; size?: 'default' | 'wide' | 'import'; children: ReactNode; returnFocus?: React.RefObject<HTMLElement | null> };

function DialogLayer({ title, description, busy, progress, size, children, origin, native }: Omit<FluidDialogProps, "open" | "onClose" | "onExited"> & { origin: React.RefObject<HTMLElement | null>; native: boolean }) {
  const { t } = useI18n();
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const mountedAt = useRef(0);
  const header = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const height = useMotionValue<number | 'auto'>('auto');
  // The height the dialog is settling to; an animation in flight is not restarted for it.
  const targetHeight = useRef<number | undefined>(undefined);
  const [scrollable, setScrollable] = useState(false);
  const pending = Boolean(progress);
  useLayoutEffect(() => {
    // The form leaves the focus tree during a blocking import. Keep Radix's
    // existing modal/focus owner instead of opening a second stacked dialog.
    if (pending) surface.current?.focus({ preventScroll: true });
  }, [pending]);
  useLayoutEffect(() => {
    if (size !== 'import' || !header.current || !body.current) return;
    let resizing: AnimationPlaybackControls | undefined;
    const measure = () => {
      // Used CSS heights preserve fractional layout pixels without counting a
      // host zoom/transform twice, unlike viewport-space bounding rectangles.
      const next = parseFloat(getComputedStyle(header.current!).height) + parseFloat(getComputedStyle(body.current!).height) + 2;
      // Compare with the height actually applied, not a separate copy: a
      // remount (React StrictMode in development) resets the motion value to
      // 'auto' while refs survive, which left the dialog stretched.
      const current = height.get();
      if (typeof current !== 'number' || reduced || pending) {
        height.jump(next);
      } else if (Math.abs(next - current) > .1 && Math.abs(next - (targetHeight.current ?? current)) > .1) {
        resizing?.stop();
        resizing = animate(height, next, motionTokens.spring.smooth);
      }
      targetHeight.current = next;
      const css = surface.current && getComputedStyle(surface.current);
      const parent = surface.current?.closest<HTMLElement>('.desktop-panel');
      const limit = (native ? parent?.clientHeight ?? window.innerHeight : window.innerHeight) - parseFloat(css?.getPropertyValue('--space-8') || '32');
      setScrollable(Boolean(limit && next > limit));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header.current); observer.observe(body.current); measure();
    window.addEventListener('resize', measure);
    if (surface.current?.parentElement) observer.observe(surface.current.parentElement);
    return () => { resizing?.stop(); observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [size, native, reduced, height, pending]);
  useLayoutEffect(() => { mountedAt.current = performance.now(); }, []);
  // One shared entrance: the card and its contents rise together, with a
  // readable fade and a soft, non-bouncing landing. Height has its own owner.
  const fade: Transition = { duration: reduced ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.standard] };
  const transition: Transition = reduced ? { duration: 0 } : {
    opacity: fade,
    y: motionTokens.spring.smooth,
  };
  const exit: TargetAndTransition = { opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } };
  return <>
    <DialogPrimitive.Overlay asChild forceMount><motion.div className={`${styles.overlay} ${native ? styles.native : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={exit} transition={fade} /></DialogPrimitive.Overlay>
    <DialogPrimitive.Content asChild forceMount {...(!description ? { 'aria-describedby': undefined } : {})} onEscapeKeyDown={event => event.stopPropagation()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        // Exit runs later than the close gesture. Do not steal focus from a
        // replacement menu/editor or a control the user has already clicked.
        const active = document.activeElement;
        const anotherLayer = document.querySelector('[role="dialog"]:not([aria-hidden="true"]), [role="menu"][data-state="open"]');
        const focusReleased = !active || active === document.body || active.closest('[role="dialog"][aria-hidden="true"]');
        if (!anotherLayer && focusReleased && origin.current?.isConnected) origin.current.focus();
      }}
      onPointerDownOutside={event => {
        // A newly mounted dialog must not dismiss on the press that opened it.
        if (busy || !present || event.detail.originalEvent.timeStamp < mountedAt.current) event.preventDefault();
      }}>
      {/* Inert owns the exiting surface's input and accessibility exclusion.
          A simultaneous aria-hidden can hide the still-focused close/action
          button before the browser processes inert and releases its focus. */}
      <motion.section layoutRoot ref={surface} data-arc-ui data-size={size} data-progress={pending || undefined} data-scrollable={scrollable} inert={!present} aria-busy={pending ? undefined : busy || undefined} className={`${styles.content} ${native ? styles.native : ""}`}
        style={size === 'import' ? { height } : undefined} initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ ...exit, y: reduced ? 0 : 8 }} transition={transition}>
        <div ref={header} className={pending ? undefined : styles.header}>
          {pending ? <DialogPrimitive.Title className={styles.visuallyHidden}>{title}</DialogPrimitive.Title> : <>
          <div><DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className={styles.description}>{description}</DialogPrimitive.Description>}</div>
          <DialogPrimitive.Close asChild><Button type="button" variant="ghost" size="sm" className={styles.close} disabled={busy} aria-label={t("Close dialog")}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button></DialogPrimitive.Close>
          </>}
        </div>
        <div ref={body} className={styles.body}>{pending ? progress : children}</div>
      </motion.section>
    </DialogPrimitive.Content>
  </>;
}

// Platform adapter, not an Arc source fork. Arc's DialogContent portals to body;
// the native window needs Radix's documented container on the visible pane.
// Radix still owns dismissal, focus trapping, outside accessibility and Escape.
export function FluidDialog({ open, onClose, onExited, returnFocus, ...props }: FluidDialogProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  // Resolve the native portal and focus origin before the opening frame.
  useLayoutEffect(() => {
    if (!open) return;
    origin.current = returnFocus?.current ?? document.activeElement as HTMLElement | null;
    setHost(document.querySelector<HTMLElement>('.desktop-panel') ?? document.body);
  }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!next && !props.busy) onClose(); }}>
    <AnimatePresence onExitComplete={onExited}>{open && host && <DialogPrimitive.Portal key="dialog" container={host} forceMount>
      <DialogLayer {...props} origin={origin} native={host.classList.contains("desktop-panel")} />
    </DialogPrimitive.Portal>}</AnimatePresence>
  </Dialog>;
}
