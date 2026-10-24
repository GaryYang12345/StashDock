import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { links } from '../copy';
import { useSite } from '../parts/useSite';
import { OsMark } from '../parts/OsMark';
import './hero.css';

const cubic = (value: readonly number[]) => value as [number, number, number, number];
const HOLD_MS = 2200;
// Any AI app: the mark in the title cycles through them.
const marks = ['openai', 'claude-color', 'gemini-color', 'deepseek-color', 'workbuddy-color', 'kimi']
  .map(file => `${import.meta.env.BASE_URL}logos/${file}.svg`);

export function Hero() {
  const { copy } = useSite();
  const enter = (delay: number) => ({ initial: { opacity: 0, y: 16, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: .9, delay, ease: cubic(motionTokens.ease.enter) } });
  return <section className="hero" id="top">
    <div className="hero-copy page">
      <motion.h1 className="display display-xl hero-title" aria-label={copy.hero.plain} {...enter(0)}>
        {copy.hero.title.split('\n').map(line => <span key={line} className="hero-line" aria-hidden="true">{inline(line)}</span>)}
      </motion.h1>
      <motion.p className="lede hero-lede" {...enter(.12)}>{copy.hero.body}</motion.p>
      <motion.div className="hero-actions" {...enter(.22)}>
        <a className="pill primary large" href={links.desktop}><OsMark os="windows" />{copy.hero.windows}</a>
        <a className="pill primary large" href={links.mac}><OsMark os="mac" size={17} />{copy.hero.mac}</a>
      </motion.div>
      <motion.a className="hero-plugin" href={links.plugin} {...enter(.3)}>{copy.hero.plugin}<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" /></motion.a>
    </div>
  </section>;
}

// "{folder}" and "{ai}" in the title become icons set into the line of type.
function inline(line: string): ReactNode {
  return line.split(/(\{\w+\})/).filter(Boolean).map((part, i) => <Fragment key={i}>{
    part === '{folder}' ? <span className="title-icon title-folder"><FolderArtwork /></span>
      : part === '{ai}' ? <AiMark />
      : part
  }</Fragment>);
}

function AiMark() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => { marks.forEach(src => { const image = new Image(); image.src = src; }); }, []);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex(value => (value + 1) % marks.length), HOLD_MS);
    return () => window.clearInterval(id);
  }, [reduced]);
  return <span className="title-icon title-ai">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.img key={index} src={marks[index]} alt="" draggable={false}
        initial={{ y: '70%', opacity: 0, scale: .6, filter: 'blur(6px)' }} animate={{ y: '0%', opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ y: '-70%', opacity: 0, scale: .6, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 260, damping: 26, mass: .9 }} />
    </AnimatePresence>
  </span>;
}
