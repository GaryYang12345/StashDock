import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Play } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { useInView } from './useSite';

const SETTLE_MS = 800;

export function ReplayButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <Button type="button" variant="secondary" size="sm" className="demo-replay" onClick={onClick} disabled={disabled}><Play size={15} strokeWidth={1.75} aria-hidden="true" />{label}</Button>;
}

// Let the reader see the resting window before a demonstration starts.
export function useFirstView<T extends Element>(margin = '-48% 0px -48% 0px') {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<T>(margin);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setTimeout(() => setRun(value => value || 1), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [inView, reduced]);
  return { ref, run, restart: () => setRun(value => value + 1) };
}
