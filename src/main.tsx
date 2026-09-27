import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
// Order is the contract: reset (layer reset) → component base (astryx-base)
// → our tokens, which stay unlayered and therefore beat every Astryx layer.
// Swapping any two of these silently changes which styles win.
import './index.css';
import App from './App';

// No global idle preload: usePageData idle-preloads the visible page's
// chunks; everything else loads on demand via ensureWidgetLoaded.
import { GlimpseThemeProvider } from './client/theme/GlimpseThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GlimpseThemeProvider>
        <App />
      </GlimpseThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
