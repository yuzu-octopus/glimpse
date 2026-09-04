import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
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
