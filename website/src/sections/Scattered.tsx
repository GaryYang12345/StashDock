import { forwardRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import { ReferenceGlyph, type ReferenceVisualKind } from '../../../src/components/ReferenceVisual';
import xMark from '../../../src/assets/brands/x.svg';
import githubMark from '../../../src/assets/brands/github.svg';
import chromeMark from '../../../src/assets/brands/chrome.svg';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import xiaohongshuMark from '../../../src/assets/brands/xiaohongshu.png';
import { useSite } from '../parts/useSite';
import './scattered.css';

export const ARRIVE = .62;
type Mark = { glyph: ReferenceVisualKind } | { image: string };
// Where each fragment starts, relative to the folder: x in vw, y in vh, tilt in degrees.
const fragments: { mark: Mark; x: number; y: number; r: number; start: number }[] = [
  { mark: { glyph: 'note' }, x: -33, y: -17, r: -6, start: .1 },
  { mark: { glyph: 'pdf' }, x: 31, y: -19, r: 5, start: .16 },
  { mark: { image: xMark }, x: -17, y: -9, r: 4, start: .22 },
  { mark: { image: xiaohongshuMark }, x: 18, y: -6, r: -4, start: .16 },
  { mark: { image: chromeMark }, x: -7, y: 23, r: 3, start: .2 },
  { mark: { image: chatgptMark }, x: 38, y: 7, r: -3, start: .24 },
  { mark: { image: githubMark }, x: -30, y: 12, r: -2, start: .16 },
  { mark: { glyph: 'web' }, x: 24, y: 19, r: 4, start: .26 },
  { mark: { glyph: 'spreadsheet' }, x: -3, y: -21, r: -2, start: .22 },
];

// The problem, felt rather than listed: pieces of context float apart, then
// scrolling gathers them into the shared folder (drawn by Story, not here).
// The pieces and the heading fade in once the section is pinned, so nothing
// scrolls through the folder on the way.
export const Scattered = forwardRef<HTMLElement, { progress?: MotionValue<number> }>(function Scattered({ progress }, ref) {
  const { copy } = useSite();
  if (!progress) return <section className="scattered still" aria-labelledby="scattered-title">
    <div className="page scattered-copy">
      <h2 id="scattered-title" className="display display-lg">{copy.scattered.title}</h2>
      <p className="lede">{copy.scattered.body}</p>
    </div>
    <ul className="scattered-list" role="list">{fragments.map((fragment, i) => <li key={i} className="fragment"><FragmentMark mark={fragment.mark} /><span>{copy.scatter[i]}</span></li>)}</ul>
    <div className="scattered-folder-still"><FolderArtwork /></div>
    <p className="display display-sm scattered-after">{copy.scattered.after}</p>
  </section>;
  return <section className="scattered" ref={ref} aria-labelledby="scattered-title">
    <div className="scattered-sticky">
      <Pinned progress={progress} />
    </div>
  </section>;
});

function Pinned({ progress }: { progress: MotionValue<number> }) {
  const { copy } = useSite();
  const title = useTransform(progress, [.05, .11, ARRIVE, .8], [0, 1, 1, .32]);
  const titleY = useTransform(progress, [.05, .11], [14, 0]);
  const after = useTransform(progress, [.68, .82], [0, 1]);
  const afterY = useTransform(progress, [.68, .82], [16, 0]);
  return <>
    <motion.div className="page scattered-copy" style={{ opacity: title, y: titleY }}>
      <h2 id="scattered-title" className="display display-lg">{copy.scattered.title}</h2>
      <p className="lede">{copy.scattered.body}</p>
    </motion.div>
    <div className="scattered-field" aria-hidden="true">
      {fragments.map((fragment, i) => <Fragment key={i} progress={progress} {...fragment} label={copy.scatter[i]} />)}
    </div>
    <motion.p className="display display-sm scattered-after" style={{ opacity: after, y: afterY }}>{copy.scattered.after}</motion.p>
  </>;
}

function Fragment({ progress, mark, x, y, r, start, label }: { progress: MotionValue<number>; mark: Mark; x: number; y: number; r: number; start: number; label: string }) {
  // Fragments set off in a loose order but all arrive together, so the
  // folder closes on a complete set rather than waiting for one straggler.
  const end = ARRIVE;
  const left = useTransform(progress, [0, start, end], [`${x * 1.08}vw`, `${x}vw`, '0vw']);
  const top = useTransform(progress, [0, start, end], [`${y * 1.12 + 4}vh`, `${y}vh`, '-2vh']);
  const rotate = useTransform(progress, [start, end], [r, 0]);
  const scale = useTransform(progress, [start, end - .05, end], [1, .55, .3]);
  const opacity = useTransform(progress, [.03, .09, end - .07, end], [0, 1, 1, 0]);
  return <motion.div className="fragment floating" style={{ x: left, y: top, rotate, scale, opacity }}>
    <FragmentMark mark={mark} /><span>{label}</span>
  </motion.div>;
}

function FragmentMark({ mark }: { mark: Mark }) {
  return <span className="fragment-mark">{'glyph' in mark ? <ReferenceGlyph kind={mark.glyph} size={20} /> : <img src={mark.image} alt="" width={18} height={18} draggable={false} />}</span>;
}
