import type { CSSProperties } from 'react';
import { SiteIdentity } from '../../../src/components/SiteIdentity';
import { ReferenceGlyph } from '../../../src/components/ReferenceVisual';
import card from '../../../src/components/StashCard.module.css';
import { savedDemoReferences } from '../demo-references';
import { heroReferenceLayout as layout } from '../hero-reference-layout';
import './hero-references.css';

// Public, owner-selected demo assets only. Never read a visitor's library.
export const heroReferenceIds = layout.cards.map(card => card.id);
const items = layout.cards.map(placement => {
  const { id } = placement;
  const item = savedDemoReferences.find(reference => reference.id === id);
  if (!item) throw new Error(`Missing hero reference: ${id}`);
  return { item: { ...item, tags: [] }, style: {
    '--hero-x': `${placement.x / layout.canvas.width * 100}%`,
    '--hero-bottom-offset': `${layout.canvas.height - placement.y}px`,
    '--hero-rotation': `${placement.rotation}deg`,
    '--hero-scale': placement.scale,
    '--hero-z': placement.z,
  } as CSSProperties };
});
const fadeStyle = {
  '--hero-fade-start-offset': `${layout.canvas.height - layout.fade.start}px`,
  '--hero-fade-end-offset': `${layout.canvas.height - layout.fade.start - layout.fade.height}px`,
  '--hero-fade-end-alpha': 1 - layout.fade.strength / 100,
} as CSSProperties;

export function HeroReferences() {
  return <div className="hero-references" style={fadeStyle} aria-hidden="true" inert>
    {items.map(({ item, style }, index) => <div className={`hero-reference-position hero-reference-${index}`} style={style} data-hero-reference={item.id} key={item.id}>
      <div className={`${card.card} hero-reference-paper`}>
        <div className={card.artwork}><div className={card.preview}>
          <img src={item.preview} alt="" decoding="async" draggable={false} />
        </div></div>
        <div className={card.details}>
          <h3>{item.title}</h3>
          {item.kind === 'web' && !item.origin?.faviconUrl
            ? <span className="hero-reference-source"><ReferenceGlyph kind="web" size={16} /><span>{item.source}</span></span>
            : <SiteIdentity item={item} />}
        </div>
      </div>
    </div>)}
  </div>;
}
