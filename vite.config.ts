import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Sur GitHub Pages, le site vit dans un sous-dossier : BASE_PATH=/budget-app/ npm run build
const base = process.env.BASE_PATH ?? '/'

// Version affichée dans les réglages : date du build et commit déployé.
const buildDate = new Date().toISOString().slice(0, 10)
const commit = (process.env.GITHUB_SHA ?? '').slice(0, 7)

export default defineConfig({
  base,
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Spendable',
        short_name: 'Spendable',
        description: 'Spendable — budget par enveloppes, hors ligne et sans compte.',
        lang: 'fr-CH',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f2ee',
        theme_color: '#0d4529',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est mis en cache : l'app doit fonctionner sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
