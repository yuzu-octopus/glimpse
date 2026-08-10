import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './index.css';
import App from './App';
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
