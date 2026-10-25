import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import brandMark from '../../../assets/brand/icon.svg';
import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import { links } from '../copy';
import { useSite } from '../parts/useSite';
import { OsMark } from '../parts/OsMark';
import { HeroReferences } from '../parts/HeroReferences';
import './hero.css';

const cubic = (value: readonly number[]) => value as [number, number, number, number];
const HOLD_MS = 2200;
// Any AI app: the mark in the title cycles through them.
const marks = ['openai', 'claude-color', 'gemini-color', 'deepseek-color', 'workbuddy-color', 'kimi-app', 'grok', 'meta-color', 'cursor']
  .map(file => `${import.meta.env.BASE_URL}logos/${file}.svg`);

export function Hero({ showReferences = true }: { showReferences?: boolean }) {
  const { copy } = useSite();
  const enter = (delay: number) => ({ initial: { opacity: 0, y: 16, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: .9, delay, ease: cubic(motionTokens.ease.enter) } });
  return <section className="hero" id="top">
    {showReferences && <HeroReferences />}
    <div className="hero-copy page">
      <motion.h1 className="display display-xl hero-title" aria-label={copy.hero.plain} {...enter(0)}>
        {copy.hero.title.split('\n').map(line => <span key={line} className="hero-line" aria-hidden="true">{inline(line)}</span>)}
      </motion.h1>
      <motion.p className="lede hero-lede" {...enter(.16)}>{copy.hero.body}</motion.p>
      <motion.div className="hero-actions" {...enter(.26)}>
        <a className="pill primary large" href={links.desktop}><OsMark os="windows" />{copy.hero.windows}</a>
        <a className="pill primary large" href={links.mac}><OsMark os="mac" size={17} />{copy.hero.mac}</a>
      </motion.div>
      <motion.a className="hero-badge" href={links.plugin} {...enter(.34)}>
        <img src={chatgptMark} alt="" width={18} height={18} /><span>{copy.hero.badge}</span>
        <span className="hero-badge-action">{copy.hero.badgeAction}<ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></span>
      </motion.a>
    </div>
  </section>;
}

// "{folder}" and "{ai}" in the title become marks set into the line of type:
// StashDock's own mark in grey, then any AI's.
function inline(line: string): ReactNode {
  return line.split(/(\{\w+\})/).filter(Boolean).map((part, i) => <Fragment key={i}>{
    part === '{folder}' ? <span className="title-icon title-brand"><img src={brandMark} alt="" draggable={false} /></span>
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
        initial={{ y: '60%', opacity: 0, scale: .6, filter: 'blur(6px)' }} animate={{ y: '0%', opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ y: '-60%', opacity: 0, scale: .6, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 260, damping: 26, mass: .9 }} />
    </AnimatePresence>
  </span>;
}
