import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { FolderArtwork } from '../../../src/components/FolderArtwork';
import { motionTokens } from '../../../src/components/arc/lib/motion-tokens';
import { Hero } from './Hero';
import { ARRIVE, Scattered } from './Scattered';
import './story.css';

const cubic = (value: readonly number[]) => value as [number, number, number, number];

// The hero and the scattered section share one floating folder. It stays still
// on the screen from the first view until the scattered pieces have gathered into it,
// then leaves with the end of that section.
export function Story() {
  const reduced = useReducedMotion();
  const scattered = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: scattered, offset: ['start start', 'end end'] });
  if (reduced) return <><Hero /><Scattered /></>;
  return <div className="story">
    <Hero />
    <Scattered ref={scattered} progress={scrollYProgress} />
    <div className="story-track"><StoryFolder progress={scrollYProgress} /></div>
  </div>;
}

function StoryFolder({ progress }: { progress: MotionValue<number> }) {
  // A small swell as the pieces arrive, then it settles.
  const scale = useTransform(progress, [0, ARRIVE - .05, ARRIVE + .03, ARRIVE + .1], [1, 1, 1.08, 1]);
  return <motion.div className="story-folder" style={{ scale }}
    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: .4, ease: cubic(motionTokens.ease.enter) }}>
    <button type="button" className="story-folder-button" aria-label="StashDock" onClick={() => document.getElementById('desktop')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
      <span className="story-folder-surface"><FolderArtwork /></span>
    </button>
  </motion.div>;
}
