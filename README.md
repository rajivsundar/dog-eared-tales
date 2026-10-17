# Twice Told

**Great free stories, picked for you. Start short. Fall for the classics.**

Twice Told is a free reading app that recommends public-domain short stories, essays and novellas, and learns your taste from how you react and what you finish. It runs entirely in your browser, works offline, and installs to your home screen.

> Named after Nathaniel Hawthorne's _Twice-Told Tales_ (1837) — stories worth telling again.

## What it does

- **Your Shortlist** — six picks a day, matched to your moods and favourite genres, each with a one-line reason. In the evening it becomes **Tonight's Shortlist**.
- **Dog-ear** — keep a work for later; find it under **Dog-eared** in your Library.
- **Your Long List** — once you've enjoyed a few short reads, longer works to grow into.
- **Learns as you read** — reactions ("Loved it", "Not for me") and finished or abandoned reads shape future picks. You can see and reset your taste in Settings.
- **Reads offline** — everything on Your Shortlist and every dog-eared work is cached for reading without a signal.

## Privacy

Your reading data stays on your device. There are no accounts, no server database, no analytics and no tracking. You can export or import your data from Settings.

## Tech stack

| Area              | Choice                                                       |
| ----------------- | ------------------------------------------------------------ |
| App               | Vite + React + TypeScript                                    |
| Styling           | Tailwind CSS with design tokens                              |
| Storage           | Dexie (IndexedDB), on-device only                            |
| Reader            | foliate-js behind a `ReaderEngine` adapter                   |
| Offline / install | vite-plugin-pwa (Workbox)                                    |
| Tests             | Vitest, Playwright, axe-core                                 |
| Hosting           | Cloudflare Workers static assets, deployed by GitHub Actions |

## Getting started

Requires Node.js 24 or newer (the catalog script runs TypeScript directly).

```bash
npm install
npm run dev       # start at http://localhost:5173
```

`npm run dev` and `npm run build` first run `npm run catalog`, which rebuilds `public/catalog/`, `public/texts/` and `public/covers/` from `content/`. Those folders are generated and not committed.

| Script                               | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`                        | Start the app locally                                                 |
| `npm run build`                      | Build the static site into `dist/`                                    |
| `npm run preview`                    | Serve the built site locally                                          |
| `npm run catalog`                    | Build `public/catalog/catalog.json`, texts and covers from `content/` |
| `npm test`                           | Unit tests (Vitest)                                                   |
| `npm run e2e`                        | End-to-end tests (Playwright)                                         |
| `npm run lint` / `npm run typecheck` | Code checks                                                           |
| `npm run deploy`                     | Build and deploy to Cloudflare                                        |

## Project structure

```text
content/        Source EPUBs (raw/), sources.csv, curation.json
docs/           SRS.md (product reference)
public/         Built catalog, texts and covers
scripts/        build-catalog and other build scripts
src/
  app/          Shell, routing, theme, install prompt
  features/     onboarding, shortlist, detail, reader, library, settings
  engine/       reader (ReaderEngine) and recommend (recommender)
  stores/       Dexie stores (the only code that touches IndexedDB)
  catalog/      Catalog loading and types
  pwa/          Service worker and caching
```

## Content and licenses

- Texts come only from **Project Gutenberg** and **Standard Ebooks**, unchanged, with source and license recorded for every work.
- Project Gutenberg files keep the Project Gutenberg License.
- Standard Ebooks editions are dedicated to the public domain (CC0).
- The app never generates or paraphrases book text.

## Deployment

Every push to `main` runs the checks and deploys to Cloudflare Workers via GitHub Actions, using the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Live site: <https://twice-told.rajivsundar.workers.dev>

## For contributors and AI assistants

- `AGENTS.md`: project rules
- `CONTEXT.md`: product name, tagline and glossary (UI labels and code terms)
- `docs/SRS.md`: full requirements

## License

Code: All rights reserved. Book texts: see Content and licenses.
