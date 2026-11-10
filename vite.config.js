import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH: ścieżka, pod którą gra jest serwowana (GitHub Pages: /<repo>/). Domyślnie '/'.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  server: { port: 5173 },
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      // 'prompt': nowa wersja czeka na następne uruchomienie (lub przycisk „Aktualizuj”) zamiast
      // przeładowywać otwartą aplikację — patrz src/ui/pwa.js
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'KORONA',
        short_name: 'KORONA',
        description: 'Arena PvP: zabij bossa, przejmij koronę.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#07070d',
        theme_color: '#07070d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2 w precache: bez tego czcionka szła z sieci przy każdym starcie (a offline nie było jej wcale)
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        // pierwsza instalacja przejmuje stronę od razu (tryb offline działa bez ponownego otwarcia);
        // aktualizacja NIE przejmuje — czeka (skipWaiting dopiero na żądanie)
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
