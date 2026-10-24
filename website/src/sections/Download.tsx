import { ArrowUpRight } from 'lucide-react';
import { OsMark } from '../parts/OsMark';
import brandTile from '../../../src-tauri/icons/icon.png';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import chromeMark from '../../../src/assets/brands/chrome.svg';
import edgeMark from '../../../src/assets/brands/edge.svg';
import firefoxMark from '../../../src/assets/brands/firefox.svg';
import safariMark from '../../../src/assets/brands/safari.svg';
import claudeMark from '../../../src/assets/brands/claude.svg';
import { links } from '../copy';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import './download.css';

export function Download() {
  const { copy } = useSite();
  const text = copy.download;
  return <section className="section download" id="download" aria-labelledby="download-title">
    <Reveal className="page section-head center">
      <h2 id="download-title" className="display display-lg">{text.title}</h2>
    </Reveal>
    <div className="download-grid page">
      <Reveal className="download-card main">
        <img className="download-tile" src={brandTile} alt="" width={72} height={72} />
        <div className="download-text"><h3 className="display-sm">{text.desktop}</h3><p className="small">{text.desktopMeta}</p></div>
        <div className="download-actions">
          <a className="pill primary" href={links.desktop}><OsMark os="windows" size={15} />{text.windows}</a>
          <a className="pill primary" href={links.mac}><OsMark os="mac" size={16} />{text.mac}</a>
        </div>
      </Reveal>
      <Reveal className="download-card" delay={80}>
        <span className="download-marks">{[chatgptMark, claudeMark].map(mark => <img key={mark} src={mark} alt="" width={28} height={28} />)}</span>
        <div className="download-text"><h3 className="display-sm">{text.plugin}</h3><p className="small">{text.pluginMeta}</p></div>
        <a className="pill secondary small" href={links.plugin}>{text.pluginAction}<ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" /></a>
      </Reveal>
      <Reveal className="download-card" delay={160}>
        <span className="download-marks">{[chromeMark, edgeMark, firefoxMark, safariMark].map(mark => <img key={mark} src={mark} alt="" width={28} height={28} />)}</span>
        <div className="download-text"><h3 className="display-sm">{text.extension}</h3><p className="small">{text.extensionMeta}</p></div>
        <a className="pill secondary small" href={links.extension}>{text.extensionAction}<ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" /></a>
      </Reveal>
    </div>
  </section>;
}
