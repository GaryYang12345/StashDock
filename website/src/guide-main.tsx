import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../../src/components/arc/foundation.css';
import './site.css';
import { SiteShell } from './parts/SiteShell';
import { Guide } from './guide/Guide';

createRoot(document.getElementById('root')!).render(<StrictMode><SiteShell guide><Guide /></SiteShell></StrictMode>);
