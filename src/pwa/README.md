# pwa

Offline and install support (vite-plugin-pwa, Workbox; configured in vite.config.ts).

- **Precache** (the app shell): HTML, scripts, styles, icons, manifest, the reader fonts, `catalog/catalog.json` and `covers/`.
- **Runtime cache** `twice-told-texts`: `/texts/*.epub`, cache-first. A book is stored the first time it is opened. Texts are never precached.
- **Navigation fallback** to `index.html`, so `/read/:id` and `/library` open offline.
- **Updates**: `UpdateBanner` shows "New version available · Update". The page reloads only when the reader taps Update.
- **Icons**: `npm run icons` redraws `public/icons/` and `public/favicon.svg` (original art, made from simple shapes).
- Unit tests use `registerStub.ts` in place of the virtual `virtual:pwa-register/react` module.

## Offline books

`src/pwa/textCache.ts` quietly stores book files in the `twice-told-texts` cache ahead of time: every pick on today's Your Shortlist and Your Long List, and every Dog-eared and Reading work (`features/offline/offlineTargets.ts`). Each file is fetched once, nothing is stored offline or with under 50 MB free, and cards, the Library and the detail sheet show an "Available offline" icon for stored books. Opening an unsaved book while offline shows a friendly message instead of the error page.
