import type { ReactNode } from 'react';
import { useInView } from './useSite';

// Content rises once into place when it first scrolls into view.
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'header' }) {
  const [ref, shown] = useInView<HTMLDivElement>();
  return <Tag ref={ref as never} className={`reveal ${className}`} data-shown={shown || undefined} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}
