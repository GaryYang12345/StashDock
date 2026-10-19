import { createRoot } from 'react-dom/client';
import '../../components/arc/foundation.css';
import '../../styles/product-tokens.css';
import '../../styles/scrollbars.css';
import './base.css';
import { McpShelf } from './McpShelf';
import { TooltipLayer } from '../../components/TooltipLayer';
import { McpSettingsProvider } from './settings';

createRoot(document.getElementById('root')!).render(<McpSettingsProvider><McpShelf /><TooltipLayer /></McpSettingsProvider>);
