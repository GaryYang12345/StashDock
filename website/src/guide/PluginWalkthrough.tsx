import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, ChevronDown, Globe, Grid2X2, Mic, MoreHorizontal, PanelRight, Pause, Play, Plus, Search, Settings, Terminal, X } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { BrandIcon } from '../../../src/components/BrandIcon';
import { ReferenceCardView } from '../../../src/components/StashCard';
import type { StashItem } from '../../../src/types';
import brandMark from '../../../assets/brand/icon.svg';
import chatgpt from '../../../src/assets/brands/chatgpt.svg';
import designCover from '../assets/covers/design-spells.jpg';
import designFavicon from '../assets/favicons/designspells.png?inline';
import { Cursor, useScript } from '../parts/Cursor';
import { ReplayButton, useFirstView } from '../parts/DemoPlayback';
import { useSite } from '../parts/useSite';
import { guideCopy } from './guide-copy';
import './plugin-walkthrough.css';

// Display-only examples. This tutorial never opens or modifies a local library.
const examples: StashItem[] = [
  { id: 'guide-design', title: 'Design Spells', kind: 'web', source: 'designspells.com', excerpt: '', tags: ['Design'], createdAt: '2026-10-25T00:00:00Z', preview: designCover, origin: { platform: 'chrome', importMethod: 'manual_url', importedAt: '2026-10-25T00:00:00Z', faviconUrl: designFavicon } },
  { id: 'guide-writing', title: 'Anti-defensive writing', kind: 'note', source: 'Note', excerpt: '', tags: ['Writing'], createdAt: '2026-10-25T00:00:00Z' },
];
const noop = () => {};

export function PluginWalkthrough() {
  const { language } = useSite();
  const text = guideCopy[language].walkthrough;
  const reduced = useReducedMotion();
  const view = useFirstView<HTMLDivElement>();
  const stage = useRef<HTMLDivElement>(null);
  const script = useScript(stage);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [request, setRequest] = useState({ from: 0, run: 0 });
  const transition = reduced ? { duration: 0 } : motionTokens.spring.smooth;

  useEffect(() => {
    if (view.run) setRequest(current => ({ from: 0, run: current.run + 1 }));
  }, [view.run]);
  useEffect(() => {
    if (reduced) { script.stop(); setStep(3); setPlaying(false); setPaused(false); return; }
    if (!request.run) return;
    const s = script.start();
    setStep(request.from); setPlaying(true); setPaused(false);
    s.place(stage.current ? stage.current.clientWidth - 48 : 300, 180);
    async function play() {
      const click = async (target: string, next: number) => {
        if (!await s.move(target, 650) || !await s.press()) return false;
        setStep(next);
        return s.wait(1100);
      };
      // Let a newly inserted panel settle before measuring the next target.
      if (!await s.wait(450)) return;
      if (request.from < 1 && !await click('[data-guide-target="panel"]', 1)) return;
      if (request.from < 2 && !await click('[data-guide-target="more"]', 2)) return;
      if (request.from < 3 && !await click('[data-guide-target="stashdock"]', 3)) return;
      if (!await s.wait(800)) return;
      setPlaying(false);
    }
    void play();
    return script.stop;
  }, [request, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFilm = () => {
    const box = stage.current?.getBoundingClientRect();
    if (box && (box.top < 80 || box.bottom > window.innerHeight - 72)) {
      stage.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' });
    }
  };
  const selectStep = (next: number) => {
    script.stop(); setPlaying(false); setPaused(false); setStep(next);
    showFilm();
  };
  return <figure id="open-plugin" className="guide-walkthrough">
    <figcaption><h4>{text.title}</h4><p>{text.body}</p></figcaption>
    <div ref={view.ref}>
      <div ref={stage} className="guide-film" data-step={step}>
        <div className="guide-film-scene" inert aria-hidden="true">
          <motion.div className="guide-film-chat" initial={false} animate={{ '--guide-open': step ? 1 : 0 }} transition={transition}>
            <header><span>ChatGPT</span><span className="guide-film-open" data-guide-target="panel" data-active={step > 0 || undefined}><PanelRight size={18} /></span></header>
            <div className="guide-film-hello"><img src={chatgpt} alt="" width={40} height={40} /><span>{text.hello}</span></div>
            <div className="guide-film-composer"><span>{text.placeholder}</span><div><Plus size={18} /><Mic size={16} /><span><ArrowUp size={16} /></span></div></div>
          </motion.div>
          <motion.div className="guide-film-panel" initial={false} animate={{ x: step ? '0%' : '100%' }} transition={transition}>
            <header className="guide-film-tab"><span>{step === 3 ? <><img src={brandMark} width={16} height={16} alt="" />StashDock</> : <><Globe size={16} />{text.tab}</>}<X size={14} /></span><Plus size={16} /><PanelRight size={16} /></header>
            <AnimatePresence initial={false} mode="wait">
              {step === 3 ? <motion.div key="library" className="guide-film-library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
                <div className="guide-film-library-head"><BrandIcon className="guide-film-brand" /><Settings size={15} /><Plus size={17} /></div>
                <div className="guide-film-search"><Search size={16} /><span>{text.search}</span></div>
                <div className="guide-film-filter"><span>{language === 'en' ? 'All' : '全部'}</span><span>{language === 'en' ? 'Recent' : '最近'}</span><span>{language === 'en' ? 'Web' : '网页'}</span><MoreHorizontal size={17} /></div>
                <div className="guide-film-cards">{examples.map(item => <ReferenceCardView key={item.id} item={item} view="grid" selected={false} selectable={false}
                  action={<Button size="sm">{text.add}</Button>} onToggle={noop} onFavorite={noop} onDelete={noop} onOpen={noop} />)}</div>
              </motion.div> : <motion.div key="tools" className="guide-film-tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
                <div className="guide-film-address"><Search size={15} /><MoreHorizontal size={17} /></div>
                <h5>{text.tools}</h5>
                <div className="guide-film-tool"><Terminal size={18} />{text.terminal}<MoreHorizontal size={17} /></div>
                <div className="guide-film-tool" data-guide-target="more" data-active={step === 2 || undefined}><Grid2X2 size={18} />{text.more}<ChevronDown size={16} /></div>
                <AnimatePresence>{step === 2 && <motion.div className="guide-film-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }} transition={transition}>
                  <span>{text.menu}</span><div data-guide-target="stashdock"><img src={brandMark} width={20} height={20} alt="" />StashDock</div>
                </motion.div>}</AnimatePresence>
              </motion.div>}
            </AnimatePresence>
          </motion.div>
        </div>
        {playing && !reduced && <Cursor {...script} />}
      </div>
    </div>
    <div className="guide-film-controls">
      <span className="guide-film-caption" role="status"><span>{step + 1} / 4</span>{text.steps[step]}</span>
      <div>{(playing || paused) && <Button type="button" variant="ghost" size="sm" aria-label={playing ? text.pause : text.resume} onClick={() => {
        if (playing) { script.stop(); setPlaying(false); setPaused(true); }
        else { showFilm(); setRequest(current => ({ from: step, run: current.run + 1 })); }
      }}>{playing ? <Pause size={15} /> : <Play size={15} />}</Button>}
      <ReplayButton label={text.replay} onClick={() => { showFilm(); if (reduced) selectStep(3); else setRequest(current => ({ from: 0, run: current.run + 1 })); }} /></div>
    </div>
    <ol className="guide-film-steps" aria-label={text.title}>{text.steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => selectStep(index)}><span>{index + 1}</span>{label}</button></li>)}</ol>
  </figure>;
}
