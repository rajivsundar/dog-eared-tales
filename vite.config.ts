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
        name: 'Dog-Eared Tales',
        short_name: 'Dog-Eared Tales',
        description:
          'Free classics, picked for you. Start short. Fold down a corner when one gets you.',
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
              cacheName: 'dog-eared-tales-texts',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // Worker threads start faster than child processes, and tests share one machine's cores.
    pool: 'threads',
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          // Pure logic (the recommender, the stores over fake-indexeddb, the catalog build)
          // needs no browser, so it runs in plain Node.
          name: 'unit',
          environment: 'node',
          include: [
            'src/**/*.test.ts',
            'scripts/**/*.test.ts',
            'tools/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          // Components need a DOM.
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
    // There is no service worker in unit tests, so the PWA hook is replaced by a stub.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/pwa/registerStub.ts', import.meta.url),
      ),
    },
  },
})
