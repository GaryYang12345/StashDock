import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { ReferenceEditor } from '../../src/components/ReferenceEditor';
import { ContentEditor } from '../../src/components/ContentEditor';
import { TagEditor } from '../../src/components/TagEditor';
import { FluidDialog } from '../../src/components/FluidDialog';
import { DestructiveButton } from '../../src/components/DestructiveButton';
import { Button } from '../../src/components/arc/button/button';
import { StashCard } from '../../src/components/StashCard';
import { WindowControls } from '../../src/components/WindowControls';
import type { StashItem } from '../../src/types';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
const item:StashItem={id:'modal-fixture',title:'Saved reference title',kind:'note',source:'Personal note',content:'Saved context.',excerpt:'',tags:['Research'],createdAt:'2026-10-11'};
function Fixture(){
  const [mode,setMode]=useState(''); const close=()=>setMode('');
  return <MotionConfig reducedMotion="user"><p>Isolated real-component modal fixture. No library writes.</p>{['Edit card','Edit content','Rename tag','Remove tag','Delete reference'].map(name=><button key={name} onClick={()=>setMode(name)}>{name}</button>)}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:16}}>{['First','Second','Third'].map(name=><StashCard key={name} item={{...item,id:name,title:name}} selected={false} copied={false} dragItems={[]} view="grid" onToggle={()=>{}} onFavorite={()=>{}} onDelete={()=>setMode('Delete reference')} onOpen={()=>{}} onCopy={()=>{}} onEdit={()=>setMode('Edit card')} onEditContent={()=>setMode('Edit content')}/>)}</div>
    <div style={{background:'var(--surface-muted)'}}><WindowControls onCollapse={()=>{}} onClose={()=>{}}/></div>
    <ReferenceEditor item={mode==='Edit card'?item:null} availableTags={['Research','UI']} onClose={close} onSave={async()=>{}}/>
    <ContentEditor item={mode==='Edit content'?item:null} onClose={close} onSave={async()=>{}}/>
    <TagEditor operation={mode==='Rename tag'||mode==='Remove tag'?{name:'Research',action:mode==='Rename tag'?'rename':'remove'}:null} onClose={close} onSave={async()=>{}}/>
    <FluidDialog open={mode==='Delete reference'} onClose={close} title="Delete reference?" description="Remove this reference from StashDock."><div style={{display:'flex',justifyContent:'flex-end',gap:'var(--space-2)'}}><Button variant="secondary" onClick={close}>Keep reference</Button><DestructiveButton onClick={close}>Delete reference</DestructiveButton></div></FluidDialog>
  </MotionConfig>;
}
const root=document.getElementById('root')!;
if(new URLSearchParams(location.search).has('native')){root.className='floating-layer';root.dataset.surface='library';root.dataset.active='true';Object.assign(root.style,{left:'240px',top:'260px',width:'1000px',height:'620px',transform:'scale(.9)',transformOrigin:'0 0',background:'var(--surface)'});}
createRoot(root).render(<Fixture/>);
