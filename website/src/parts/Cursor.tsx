import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';

type Point = { x: number; y: number };

// A scripted pointer for the automatic demonstrations: it moves to an element
// inside the stage and presses it. Steps run in order; a new run cancels the last.
export function useScript(stage: RefObject<HTMLElement | null>) {
  const [point, setPoint] = useState<Point>({ x: -40, y: -40 });
  const [pressed, setPressed] = useState(false);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const clear = useCallback(() => { run.current++; timers.current.forEach(id => window.clearTimeout(id)); timers.current = []; }, []);
  useEffect(() => clear, [clear]);
  const wait = useCallback((ms: number, id: number) => new Promise<boolean>(resolve => {
    timers.current.push(window.setTimeout(() => resolve(id === run.current), ms));
  }), []);
  const at = useCallback((target: string | Element | null, dx = .5, dy = .5): Point | null => {
    const box = stage.current?.getBoundingClientRect();
    const element = typeof target === 'string' ? stage.current?.querySelector(target) : target;
    const rect = element?.getBoundingClientRect();
    if (!box || !rect) return null;
    return { x: rect.left - box.left + rect.width * dx, y: rect.top - box.top + rect.height * dy };
  }, [stage]);
  const start = useCallback(() => {
    clear();
    const id = run.current;
    return {
      ok: () => id === run.current,
      wait: (ms: number) => wait(ms, id),
      move: async (target: string | Element | null, ms = 700, dx?: number, dy?: number) => { const next = at(target, dx, dy); if (next) setPoint(next); return wait(ms, id); },
      place: (x: number, y: number) => setPoint({ x, y }),
      press: async () => { setPressed(true); const ok = await wait(140, id); setPressed(false); return ok && wait(120, id); },
    };
  }, [at, clear, wait]);
  return { point, pressed, start, stop: clear };
}

export function Cursor({ point, pressed }: { point: Point; pressed: boolean }) {
  return <motion.div className="script-cursor" aria-hidden="true" initial={false} animate={{ x: point.x, y: point.y, scale: pressed ? .86 : 1 }}
    transition={{ x: { type: 'spring', stiffness: 120, damping: 20, mass: .9 }, y: { type: 'spring', stiffness: 120, damping: 20, mass: .9 }, scale: { duration: .12 } }}>
    <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3.2 19 11.4l-6.2 1.6 3.4 6.6-2.6 1.3-3.4-6.6L5.6 18.9z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
  </motion.div>;
}
