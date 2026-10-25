import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { LocaleProvider } from '../../../src/features/settings/locale';
import { TooltipLayer } from '../../../src/components/TooltipLayer';
import { copy, type Language } from '../copy';
import { SiteContext, initialLanguage, rememberLanguage } from './useSite';
import { Nav } from '../sections/Nav';
import { Footer } from '../sections/Footer';

export function SiteShell({ children, guide = false }: { children: ReactNode; guide?: boolean }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const setLanguage = (next: Language) => { setLanguageState(next); rememberLanguage(next); };
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  const value = useMemo(() => ({ language, copy: copy[language], setLanguage }), [language]);
  return <SiteContext.Provider value={value}>
    <LocaleProvider language={language}>
      <MotionConfig reducedMotion="user">
        <TooltipLayer />
        <Nav guide={guide} />
        {children}
        <Footer />
      </MotionConfig>
    </LocaleProvider>
  </SiteContext.Provider>;
}
