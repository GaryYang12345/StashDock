import {createRoot} from 'react-dom/client';
import {FloatingFolder} from '../../src/components/FloatingFolder';
import '../../src/index.css';
import '../../src/components/arc/foundation.css';
import '@fontsource-variable/inter';
document.documentElement.dataset.theme = new URL(location.href).searchParams.get('theme') || 'light';
createRoot(document.getElementById('root')!).render(<div style={{padding:32}}><style>{'[data-before] .floating-folder-surface { scale: 1; }'}</style><div style={{display:'flex',gap:48,alignItems:'center'}}>
  <section data-before><p>Before</p><div style={{width:160,height:160}}><FloatingFolder onOpen={()=>{}} /></div></section>
  <section><p>90%</p><div className="desktop-folder-content"><FloatingFolder onOpen={()=>{}} /></div></section>
</div></div>);
