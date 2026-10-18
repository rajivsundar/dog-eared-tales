# Dog-Eared Tales

**Free classics, picked for you. Start short. Fold down a corner when one gets you.**

Dog-Eared Tales is a free reading app that recommends public-domain short stories, essays and novellas, and learns your taste from how you react and what you finish. It runs entirely in your browser, works offline, and installs to your home screen.

> A dog-ear is the folded corner of a page, the mark of a book somebody loved. Dog-Eared Tales is a place for stories worth turning down a corner for.

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

## Content and licences

- **Texts** are unchanged, with source and licence recorded for every work. They come from **Project Gutenberg** and **Standard Ebooks** and are in the **public domain in the United States**. Project Gutenberg files keep the Project Gutenberg License; Standard Ebooks editions are dedicated to the public domain (CC0).
- The app never generates or paraphrases book text.
- **Fonts** keep their own licences: Literata, Atkinson Hyperlegible and OpenDyslexic are under the SIL Open Font License 1.1 (via the `@fontsource` packages).
- **Libraries** keep their own licences: Dexie is Apache-2.0; foliate-js, React, React DOM, React Router, Tailwind CSS and vite-plugin-pwa (Workbox) are MIT. Other build and test tools are listed in `package.json` with their own licences.
- Dog-Eared Tales is frozen at the Twice Told v1.0 tag; see `docs/DECISIONS.md`.

## Story Guide (hackathon tool)

Story Guide is a local tool in `tools/story-guide/` that never ships in the app. It uses **Gemma 4 via the Gemini API** to suggest descriptions and labels for a story, and shows them beside the curated ones.

- **Hook and blurb:** Gemma sees only the first third of the story, so it sets up the premise without hinting at the turn or ending (hook 20 words or fewer, blurb 60 or fewer). The page says so: "Gemma wrote this blurb without seeing the ending."
- **Labels:** from the whole story, up to 3 moods (only from the catalog's mood list), content notes with intensity (none, mild or strong) for violence, death, frightening scenes, sexual themes, period racist language and animal harm, and an age band (All ages, 10+, 13+ or 16+) with a one-sentence reason for parents.
- **Checks:** the catalog's own banned-words and six-word-quote checks run on Gemma's hook and blurb, and any failure is shown.
- **Story source:** any catalog story (its text comes from the same extraction as the catalog build, so ranges and trims match what readers get), or pasted text of at least 150 words.
- **Project Gutenberg search:** searches Project Gutenberg's official catalog file (`pg_catalog.csv`) on this computer: English texts only, by title and author, case-insensitive and forgiving small misspellings (for example "edgar allen" finds Edgar Allan Poe). The file is downloaded once into the git-ignored `tools/story-guide/cache/` and refreshed only when it is more than 7 days old; if a refresh fails, the older copy is used. Picking a result downloads the book's plain text once (also cached), cuts the Gutenberg header and footer the way the catalog build does, and counts the words. The catalog lists whole books, so a story that exists only inside a collection has no entry of its own.
- **Wikisource search:** searches en.wikisource.org through the MediaWiki API, one request at a time, with a User-Agent that names this repo (Wikimedia's policy). Only pages that carry a US public-domain licence tag or category are analysed (a story inside a collection takes its parent work's tag); any other page is greyed out as "Not marked US public domain". A single page is read as the API renders it, with headers, navigation, page numbers, footnote markers and licence banners removed. A work split into chapter subpages is read subpage by subpage, in order. A versions or disambiguation page lists its editions as choices. Fetched texts are cached as `cache/ws-<title>.txt`.
- **One search, with a length filter:** one search box with a source choice (Project Gutenberg, Wikisource or Both) and a length filter (Any, Short under 5,000 words, Medium 5,000 to 20,000, Long over 20,000). Lengths are estimates shown as "about N words, N min" at 250 words a minute, and no book is downloaded just to measure it. Gutenberg: a HEAD request for the plain-text file's size, minus about 18 KB of licence text, at about 6 bytes a word. Wikisource: the word count its API reports for the page; this is only the contents page for a work split into chapters.
- **Long works:** above 20,000 words, only the first 20,000 are analysed for the full-story call, and the page says so. The blurb call still uses the first third of what is analysed.
- **Sources:** Project Gutenberg is used through its public catalog and plain-text files. Wikisource is used through the MediaWiki API, public-domain-tagged pages only. Standard Ebooks is not fetched, because its robots.txt asks AI tools not to fetch book text. The browser never contacts any of these: the server does.

To run it:

1. Get a Gemini API key at <https://aistudio.google.com/apikey>.
2. Copy `tools/story-guide/.env.example` to `tools/story-guide/.env` and fill in `GEMINI_API_KEY` and `GEMMA_MODEL` (`gemma-4-31b-it` or `gemma-4-26b-a4b-it`). The `.env` file is git-ignored; the key stays in the local server and never reaches the browser.
3. Run `npm run story-guide` and open <http://localhost:5180/>. Without a key the page shows a message instead of failing.

Very long books may be too big for the model to read in one go. Gemma's suggestions are drafts for a person to check, not published text. The tool is released under the same MIT licence as the rest of the code (see [LICENSE](LICENSE)); it uses Express (MIT) and the Gemini API, and Gemma is used under Google's Gemma terms.

## Deployment

Every push to `main` runs the checks and deploys to Cloudflare Workers via GitHub Actions, using the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Live site: the Cloudflare Workers address of the `dog-eared-tales` Worker (add the exact link here after the first deploy).

## For contributors and AI assistants

- `AGENTS.md`: project rules
- `CONTEXT.md`: product name, tagline and glossary (UI labels and code terms)
- `docs/SRS.md`: full requirements

## Licence

The code is released under the MIT licence; see [LICENSE](LICENSE). Book texts and third-party fonts and libraries keep their own licences, as described in Content and licences.
