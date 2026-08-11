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
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Boot-critical: serve the cached config when the network stalls
            // (3s) or is offline, so the page chrome renders immediately.
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
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: react/dom, Astryx core, icons. Keeps the
        // main bundle small and lets the SW cache vendors across deploys.
        manualChunks(id) {
          // Stable vendor chunks: react/dom, Astryx core, icons. Keeps the
          // main bundle small and lets the SW cache vendors across deploys.
          // `node_modules/react` also matches react-dom's path.
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
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
