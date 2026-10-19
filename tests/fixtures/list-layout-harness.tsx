import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { StashCard } from '../../src/components/StashCard';
import { DestructiveButton } from '../../src/components/DestructiveButton';
import { FluidDialog } from '../../src/components/FluidDialog';
import { TooltipLayer } from '../../src/components/TooltipLayer';
import { TagEditor } from '../../src/components/TagEditor';
import type { StashItem } from '../../src/types';
import list from '../../src/components/ReferenceList.module.css';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
const rows: StashItem[]=['Short title','An exceptionally long reference title that should occupy one line in list mode without changing the height of its row','Another short title'].map((title,i)=>({id:`fixture-${i}`,title,kind:'web',source:'example.org',url:`https://example.org/${i}`,excerpt:'',tags:[],createdAt:'2026-10-11'}));
function Fixture(){ const [deleting,setDeleting]=useState<StashItem|null>(null), [removingTag,setRemovingTag]=useState(false); return <main data-arc-ui className="fluid-ui" style={{padding:16}}><p>Shared list geometry fixture. No library writes.</p><TooltipLayer/><button onClick={()=>setRemovingTag(true)}>Remove tag fixture</button><TagEditor operation={removingTag?{name:'UI',action:'remove'}:null} onClose={()=>setRemovingTag(false)} onSave={async()=>{}}/><div className={list.list}>{rows.map(item=><StashCard key={item.id} item={item} selected={false} copied={false} dragItems={[]} view="list" onToggle={()=>{}} onFavorite={()=>{}} onDelete={setDeleting} onOpen={()=>{}} onCopy={()=>{}} onEdit={()=>{}} onEditContent={()=>{}} />)}</div><FluidDialog open={Boolean(deleting)} onClose={()=>setDeleting(null)} title="Delete reference?"><DestructiveButton onClick={()=>setDeleting(null)}>Delete reference</DestructiveButton></FluidDialog></main>; }
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="user"><Fixture/></MotionConfig>);
