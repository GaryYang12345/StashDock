import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { LocaleProvider } from '../../src/features/settings/locale';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import { copy, type Language } from './copy';
import { SiteContext, initialLanguage, rememberLanguage } from './parts/useSite';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Scattered } from './sections/Scattered';
import { LiveDemo } from './sections/LiveDemo';
import { DesktopDemo } from './sections/DesktopDemo';
import { Pillars } from './sections/Pillars';
import { Platforms } from './sections/Platforms';
import { OneLibrary } from './sections/OneLibrary';
import { Download } from './sections/Download';
import { Footer } from './sections/Footer';

export function App() {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const setLanguage = (next: Language) => { setLanguageState(next); rememberLanguage(next); };
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  const value = useMemo(() => ({ language, copy: copy[language], setLanguage }), [language]);
  return <SiteContext.Provider value={value}>
    <LocaleProvider language={language}>
      <MotionConfig reducedMotion="user">
        <TooltipLayer />
        <Nav />
        <main>
          <Hero />
          <Scattered />
          <LiveDemo />
          <DesktopDemo />
          <Pillars />
          <Platforms />
          <OneLibrary />
          <Download />
        </main>
        <Footer />
      </MotionConfig>
    </LocaleProvider>
  </SiteContext.Provider>;
}
