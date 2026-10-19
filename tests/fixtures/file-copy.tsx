import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist';
import { CopyForAI } from '../../src/components/CopyForAI';
import { copyContext } from '../../src/lib/context';
import type { StashItem } from '../../src/types';

const fixture = window as unknown as { __TAURI_INTERNALS__: {invoke: (command:string,args:unknown) => Promise<void>}; copyRequests: unknown[]; failCopy: boolean };
Object.defineProperty(globalThis, 'isTauri', {configurable:true,value:true});
Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async () => {throw Error('Native fixture must not write browser clipboard');}}});
fixture.copyRequests = [];
fixture.failCopy = false;
fixture.__TAURI_INTERNALS__ = {invoke:async (command,args) => {
  fixture.copyRequests.push({command,args});
  await new Promise(resolve => setTimeout(resolve, 180));
  if(fixture.failCopy) throw Error('Fixture clipboard locked');
}};
const items:StashItem[] = [
  {id:'first',title:'First reference',source:'StashDock',kind:'note',tags:[],excerpt:'',content:'First complete context',createdAt:'2026-10-12'},
  {id:'second',title:'Second reference',source:'StashDock',kind:'note',tags:[],excerpt:'',content:'Second complete context',createdAt:'2026-10-12'},
];
function App() {
  const [error,setError] = useState('');
  const [copied,setCopied] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {if(timer.current) clearTimeout(timer.current);},[]);
  const copy = async (key:string,selected:StashItem[]) => {
    setError('');
    setCopied('');
    try {
      await copyContext(selected);
      setCopied(key);
      if(timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(''),1800);
    } catch(e) { setError(String(e)); }
  };
  return <main data-arc-ui style={{padding:24}}>
    <CopyForAI label="Copy single reference for AI" copied={copied==='single'} onCopy={() => copy('single',items.slice(0,1))} />
    <CopyForAI label="Copy selection for AI" copied={copied==='bulk'} onCopy={() => copy('bulk',items)} />
    <p role="alert">{error}</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
