/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Glimpse',
        short_name: 'Glimpse',
        description: 'Self-hosted dashboard',
        theme_color: '#111112',
        background_color: '#111112',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}'],
        navigateFallbackDenylist: [/^\/api\//],
        // TTL tiers (single table — keep in sync):
        //   client poll  (usePageData STALE_MS)      30s  — live widgets revalidate; unchanged polls skip render
        //   server live  (shared/live LIVE_TTL_MS)    60s  — clock/weather/markets/monitor/server-stats/system-stats
        //   server static (shared/live STATIC_TTL_MS)  1h  — everything else
        //   SW api-pages (below)                    300s  — outer offline/stale bound only
        // NetworkFirst + 3s timeout = stale-while-revalidate: the SW never
        // masks a fresh network response, and the client never double-fetches
        // on a stale boundary (a slow network resolves from SW cache while
        // the live fetch still refreshes it in place).
        runtimeCaching: [
          {
            // Boot-critical: serve the cached config when the network stalls
            // (3s) or is offline, so the page chrome renders immediately.
            // /api/config sends `no-store` — the SW cache is an intentional
            // second layer for offline/stall, not a replacement for revalidation.
            urlPattern: /^\/api\/config(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 3,
              cacheName: 'api-config',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 },
            },
          },
          {
            // Per-page widget data: NetworkFirst with a short timeout gives
            // stale-while-revalidate UX — cache renders when the network is
            // slow or offline, while successful fetches refresh it in place.
            urlPattern: /^\/api\/page\//,
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 3,
              cacheName: 'api-pages',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^\/api\/theme(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 3,
              cacheName: 'api-theme',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Stable vendor chunks: react/dom (+ react-router), Astryx core, icons.
          // Keeps the main bundle small and lets the SW cache vendors across deploys.
          // `node_modules/react` also matches react-dom's path.
          if (id.includes('node_modules/react-router')) return 'react-router-dom';
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules/@astryxdesign/core')) return 'astryx';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
