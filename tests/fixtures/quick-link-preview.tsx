// Isolated import form: no native bridge and no writes to the user's collection.
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {DesktopImportDialog} from '../../src/components/DesktopImportDialog';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
const controls=window as typeof window & {saved?:unknown;resolveLookup?:()=>void;reads?:number};
const services={available:()=>true,sources:async()=>[],bookmarks:async()=>[],preview:()=>{controls.reads=(controls.reads||0)+1;return new Promise<{title:string;content:string}>(resolve=>{controls.resolveLookup=()=>resolve({title:'Fetched page title',content:'Fetched article body'});});}};
function Fixture(){const [open,setOpen]=useState(true);return <DesktopImportDialog open={open} services={services} onClose={()=>setOpen(false)} onAdd={async items=>{controls.saved=items;}}/>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
