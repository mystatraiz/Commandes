import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Mise à jour appliquée d'elle-même : sur un téléphone, un bandeau que
      // l'on ne voit pas laisse tourner une version périmée pendant des jours.
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Forge — Jeûne & Sport',
        short_name: 'Forge',
        description: 'Suivi du jeûne, du poids et du sport : padel, renfo, courbes et défis quotidiens.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D12',
        theme_color: '#0B0D12',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
    }),
  ],
  // Repère de version, affiché dans Profil : permet de dire d'un coup d'œil
  // si le téléphone tourne bien sur la dernière mise en ligne.
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  build: { target: 'es2020' },
});
