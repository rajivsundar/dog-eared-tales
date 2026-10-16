import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

// The Night and Paper theme colours (see THEME_COLORS in src/engine/reader/readerStyle.ts).
const NIGHT = '#1b1c1f'
const PAPER = '#fbf8f2'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the reader taps Update: no surprise reloads.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Twice Told',
        short_name: 'Twice Told',
        description:
          'Great free stories, picked for you. Start short. Fall for the classics.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: NIGHT,
        background_color: PAPER,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache: the app shell (HTML, JS, CSS, icons), the reader fonts, the catalog and the covers.
        globPatterns: [
          '**/*.{html,js,css,woff2,svg,png,webmanifest}',
          'catalog/catalog.json',
        ],
        // Never precache the book texts: they are large and are cached as they are opened.
        globIgnores: ['texts/**'],
        // Pages such as /read/:id and /library open offline, as not_found_handling does on Cloudflare (see wrangler.jsonc).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/texts\//, /^\/catalog\//, /^\/covers\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Book texts never change, so the first copy is kept for good.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/texts/') &&
              url.pathname.endsWith('.epub'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'twice-told-texts',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // There is no service worker in unit tests, so the PWA hook is replaced by a stub.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/pwa/registerStub.ts', import.meta.url),
      ),
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
