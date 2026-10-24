import { motion, useReducedMotion } from 'motion/react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import brandTile from '../../../src-tauri/icons/icon.png';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import chromeMark from '../../../src/assets/brands/chrome.svg';
import edgeMark from '../../../src/assets/brands/edge.svg';
import firefoxMark from '../../../src/assets/brands/firefox.svg';
import safariMark from '../../../src/assets/brands/safari.svg';
import claudeMark from '../../../src/assets/brands/claude.svg';

const logo = (file: string) => `${import.meta.env.BASE_URL}logos/${file}.svg`;
import { Reveal } from '../parts/Reveal';
import { useInView, useSite } from '../parts/useSite';
import './onelibrary.css';

// Three entry points, one library on your computer: the lines meet in the folder.
export function OneLibrary() {
  const { copy } = useSite();
  const text = copy.local;
  const reduced = useReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>('-20% 0px');
  const entries = [
    { title: text.desktop, body: text.desktopBody, marks: [brandTile] },
    // ChatGPT first, then other AI apps trailing off.
    { title: text.plugin, body: text.pluginBody, marks: [chatgptMark, claudeMark, logo('gemini-color'), logo('deepseek-color')], trail: true },
    { title: text.extension, body: text.extensionBody, marks: [chromeMark, edgeMark, firefoxMark, safariMark] },
  ];
  return <section className="section one" aria-labelledby="one-title">
    <Reveal className="page section-head center">
      <h2 id="one-title" className="display display-lg">{text.title}</h2>
      <p className="lede">{text.body}</p>
    </Reveal>
    <div className="one-hub page" ref={ref}>
      <div className="one-entries">
        {entries.map((entry, i) => <Reveal key={entry.title} className="one-entry" delay={i * 90}>
          <span className="one-marks" data-trail={'trail' in entry || undefined}>{entry.marks.map(mark => <img key={mark} className={mark === brandTile ? 'tile' : undefined} src={mark} alt="" width={36} height={36} />)}</span>
          <h3 className="display-sm">{entry.title}</h3>
          <p className="small">{entry.body}</p>
        </Reveal>)}
      </div>
      <svg className="one-lines" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
        {['M167 0 C167 120, 500 90, 500 210', 'M500 0 L500 210', 'M833 0 C833 120, 500 90, 500 210'].map((d, i) =>
          <motion.path key={d} d={d} fill="none" stroke="var(--border-strong)" strokeWidth="1.25" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: shown || reduced ? 1 : 0 }} transition={{ duration: 1.1, delay: .2 + i * .12, ease: [.16, 1, .3, 1] }} />)}
      </svg>
      <motion.div className="one-folder" initial={{ scale: reduced ? 1 : .9, opacity: reduced ? 1 : 0 }} animate={shown || reduced ? { scale: 1, opacity: 1 } : {}} transition={{ duration: .8, delay: .9, ease: [.16, 1, .3, 1] }}>
        <FolderArtwork />
      </motion.div>
    </div>
  </section>;
}
