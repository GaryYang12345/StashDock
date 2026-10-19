import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentProps, type Ref } from 'react';
import { DesktopImportDialog } from './DesktopImportDialog';

export type ReferenceImportHandle = { open: () => void; isOpen: () => boolean };
type Props = Omit<ComponentProps<typeof DesktopImportDialog>, 'open' | 'onClose'> & {
  ref: Ref<ReferenceImportHandle>;
  active?: boolean;
};

// Keep transient dialog state below the shelf. The handle opens the existing
// form and lets host shortcuts/background work check it without subscribing
// the entire collection to each open/close. No separate store or event bus.
export function ReferenceImportDialog({ ref, active = true, ...props }: Props) {
  const [state, setState] = useState({ open: false, mounted: false });
  const visible = useRef(false);
  const close = useCallback(() => {
    visible.current = false;
    setState(previous => previous.open ? { ...previous, open: false } : previous);
  }, []);
  useImperativeHandle(ref, () => ({
    open: () => {
      if (!active) return;
      visible.current = true;
      setState(previous => previous.open ? previous : { open: true, mounted: true });
    },
    isOpen: () => visible.current,
  }), [active]);
  useEffect(() => { if (!active) close(); }, [active, close]);
  return state.mounted ? <DesktopImportDialog {...props} open={state.open} onClose={close} /> : null;
}
