import { useEffect, useState } from 'react';
import wordmark from '../assets/wordmark.png';
import { links } from '../copy';
import { useSite } from '../parts/useSite';
import './nav.css';

export function Nav({ guide = false }: { guide?: boolean }) {
  const { copy, language, setLanguage } = useSite();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const home = guide ? './index.html' : '';
  return <header className="nav" data-scrolled={scrolled || undefined}>
    <div className="nav-inner">
      <a className="nav-brand" href={`${home}#top`} aria-label="StashDock"><img src={wordmark} alt="StashDock" width={170} height={24} /></a>
      <nav className="nav-links" aria-label="Sections">
        <a href={`${home}#how`}>{copy.nav.how}</a>
        <a href={`${home}#features`}>{copy.nav.features}</a>
        <a href={`${home}#agents`}>{copy.nav.agents}</a>
        <a className="nav-guide" href="./guide.html" aria-current={guide ? 'page' : undefined}>{copy.nav.guide}</a>
        <a href={`${home}#download`}>{copy.nav.download}</a>
      </nav>
      <div className="nav-actions">
        <button type="button" className="nav-language" aria-label={copy.nav.languageLabel} onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}>{copy.nav.language}</button>
        <a className="pill primary small" href={links.desktop}>{copy.nav.download}</a>
      </div>
    </div>
  </header>;
}
