import wordmark from '../assets/wordmark.png';
import { links } from '../copy';
import { useSite } from '../parts/useSite';

export function Footer() {
  const { copy } = useSite();
  return <footer className="footer page">
    <img src={wordmark} alt="StashDock" width={113} height={16} />
    <span className="small">{copy.footer.rights}</span>
    <a className="small" href={links.github}>{copy.footer.github}</a>
    <a className="small" href="./guide.html">{copy.nav.guide}</a>
    <span className="small footer-marks">{copy.footer.marks}</span>
  </footer>;
}
