# pwa

Offline and install support (vite-plugin-pwa, Workbox; configured in vite.config.ts).

- **Precache** (the app shell): HTML, scripts, styles, icons, manifest, the reader fonts, `catalog/catalog.json` and `covers/`.
- **Runtime cache** `twice-told-texts`: `/texts/*.epub`, cache-first. A book is stored the first time it is opened. Texts are never precached.
- **Navigation fallback** to `index.html`, so `/read/:id` and `/library` open offline.
- **Updates**: `UpdateBanner` shows "New version available · Update". The page reloads only when the reader taps Update.
- **Icons**: `npm run icons` redraws `public/icons/` and `public/favicon.svg` (original art, made from simple shapes).
- Unit tests use `registerStub.ts` in place of the virtual `virtual:pwa-register/react` module.
