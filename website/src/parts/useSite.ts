import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Copy, Language } from '../copy';

export const SiteContext = createContext<{ language: Language; copy: Copy; setLanguage: (language: Language) => void } | null>(null);
export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw Error('SiteContext is missing.');
  return value;
}

const STORAGE_KEY = 'stashdock-site-language';
// A remembered choice first, then the browser's language. Storage may be unavailable.
export function initialLanguage(): Language {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'en' || saved === 'zh') return saved; } catch { /* private mode */ }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export function rememberLanguage(language: Language) {
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* private mode */ }
}

// True once the element has scrolled into view (and stays true).
export function useInView<T extends Element>(margin = '-15% 0px') {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setShown(true); }, { rootMargin: margin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin, shown]);
  return [ref, shown] as const;
}
