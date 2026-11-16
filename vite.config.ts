import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/kamerton/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Напоминания живут в отдельном скрипте, подключаемом к service worker.
        importScripts: ['reminder-sw.js'],
        navigateFallback: '/kamerton/index.html',
      },
      manifest: {
        name: 'Камертон — классика на слух',
        short_name: 'Камертон',
        description: 'Тренажёр, который учит узнавать классическую музыку на слух.',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f0e13',
        theme_color: '#0f0e13',
        start_url: '/kamerton/',
        scope: '/kamerton/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});
