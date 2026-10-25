import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/inter';
import '../../../src/components/arc/foundation.css';
import '../site.css';
import './hero-concepts.css';
import SegmentedControl from '../../../src/components/arc/segmented-control/segmented-control';
import card from '../../../src/components/StashCard.module.css';
import { LocaleProvider } from '../../../src/features/settings/locale';
import { copy, type Language } from '../copy';
import { SiteContext } from '../parts/useSite';
import { Hero } from '../sections/Hero';
import { Nav } from '../sections/Nav';
import { HeroReferences } from '../parts/HeroReferences';
import { demoLibrary } from '../demo-data';
import type { StashItem } from '../../../src/types';

// Isolated art direction study. This entry is not imported by the published site.
// All reference imagery comes from the existing, curated public demo catalog.
const catalog = demoLibrary('en');
const picks = ['arc-ui', 'sft-rl-opd', 'design-spells', 'plot-color', 'basic-pitch', 'korea-artist'];
const references = picks.map(id => catalog.find(item => item.id === id)!);
const modes = [
  { value: 'original', label: '原版' },
  { value: 'sides', label: 'A · 两侧渐隐' },
  { value: 'fan', label: 'B · 素材扇面' },
  { value: 'ribbon', label: 'C · 轻量条带' },
];
const notes: Record<string, string> = {
  original: '原版对照。标题、文案、下载区均沿用当前版本。',
  sides: '真实 context 卡片分布在两侧，向边缘与下方渐隐。中间保持安静。',
  fan: '素材从下方展开成一个完整扇面，像翻开的一叠收藏。',
  ribbon: '用轻量的参考条目托住首屏，少量封面色彩，更低的视觉重量。',
};

function Paper({ item }: { item: StashItem }) {
  return <div className={`${card.card} study-paper`}>
    <div className={card.artwork}><div className={card.preview}><img src={item.preview} alt="" decoding="async" draggable={false} /></div></div>
    <div className={card.details}>
      <h3>{item.title}</h3>
      <span className="study-source">{item.source}</span>
    </div>
  </div>;
}

function HeroConcepts() {
  const [mode, setMode] = useState('sides');
  const [language, setLanguage] = useState<Language>('en');
  const context = useMemo(() => ({ language, copy: copy[language], setLanguage }), [language]);
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  return <SiteContext.Provider value={context}>
    <LocaleProvider language={language}>
      <MotionConfig reducedMotion="user">
        <Nav />
        <main className="hero-study" data-mode={mode}>
          <Hero showReferences={false} />
          <div className="study-art study-sides" aria-hidden="true" inert>
            <HeroReferences />
          </div>
          <div className="study-art study-fan" aria-hidden="true" inert>
            <div className="study-fan-inner">
              {references.map((item, index) => <div className={`study-position fan-${index}`} key={item.id}><Paper item={item} /></div>)}
            </div>
          </div>
          <div className="study-art study-ribbon" aria-hidden="true" inert>
            <div className="study-ribbon-row">
              {references.slice(0, 5).map(item => <div className="study-reference" key={item.id}>
                <img src={item.preview} alt="" draggable={false} />
                <div><span>{item.title}</span><small>{item.source}</small></div>
              </div>)}
            </div>
          </div>
        </main>
        <aside className="study-controls" aria-label="首屏设计方案">
          <SegmentedControl options={modes} value={mode} onValueChange={setMode} label="选择首屏方案" />
          <p lang="zh-CN" aria-live="polite">{notes[mode]}</p>
        </aside>
      </MotionConfig>
    </LocaleProvider>
  </SiteContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<HeroConcepts />);
