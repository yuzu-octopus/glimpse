import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
// Order is the contract: reset (layer reset) → component base (astryx-base)
// → the astryx-dracula kit → our own app CSS. The kit's tokens.css is
// unlayered :root, so it paints correct Dracula before the Theme provider
// mounts; its theme.css is @scope'd to [data-astryx-theme], which <Theme>
// puts on <html>. index.css is unlayered too and comes last, so app CSS wins
// wherever the two disagree. Swapping any two of these silently changes
// which styles win.
import 'astryx-dracula/tokens.css';
import 'astryx-dracula/theme.css';
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
