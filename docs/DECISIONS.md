# Decisions that override docs/SRS.md

Dated 2026-10-15.

- **Build process:** one assistant (Claude Code in VS Code), step-by-step prompts. No agent crew, Antigravity, gates (G0–G5, C1, C2) or Content Factory agents.
- **Code hosting:** private GitHub repo rajivsundar/twice-told; CI is GitHub Actions. No Gitea or Gitea Actions.
- **Deployment:** Cloudflare Workers static assets via `wrangler deploy`, replacing Cloudflare Pages Direct Upload (D10, EN-1203).
- **Hosting:** production is Cloudflare Workers (static assets). Netlify is retired. GitHub Actions (`.github/workflows/deploy.yml`) runs the checks on every pull request, and on a push to `main` deploys with `cloudflare/wrangler-action` using the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **Cloudflare setup:** assets only, no Worker code (`wrangler.jsonc`: `./dist`, `not_found_handling: single-page-application`). There is no `_redirects` file (Cloudflare reads it and rejects `/*  /index.html  200` as an infinite loop; Netlify is retired). `public/.assetsignore` keeps itself out of the upload; `public/_headers` sets no-cache on `sw.js` and the manifest and long caching on `/assets/*`. `npm run deploy:dry` checks it without uploading.
- **Branching:** work on `main`, with optional pull requests; no dev/test branches yet.
- **Catalog:** a hand-picked catalog defined in `content/sources.csv`, built from unchanged Project Gutenberg EPUBs in `content/raw/` (named `pg-<number>-<book-slug>.epub`, one file per Gutenberg number). Stories inside collections, and chapters of long books, are href ranges in the original file, not split files. Both EPUB 3 (nav) and EPUB 2 (NCX) books are read. A row ships only when `content/curation.json` has a record for it with `reviewed: true`, and only the books of shipped entries are published; the other rows are built and checked but held back. `story_author` (optional) overrides the EPUB's author. The 2026-10 intake added 107 rows (from 48 more EPUBs) that wait for curation. The harvester (EN-202) and Standard Ebooks feeds are deferred.
- **Intake choices:** whole books of 17,500 words or more are not added whole; only chosen chapters are (as essays titled as printed, shown "from <book>"). Short whole books (Communist Manifesto, Tao Teh King, Apology, As a Man Thinketh, The Magic Fishbone, The Prophet) are single entries.
- **Genres:** the allowed list is horror, mystery, ghost story, satire, humour, romance, adventure, science fiction, literary, philosophy, social criticism, politics, history, memoir, spirituality, self-help, science, war and fantasy.
- **Curation rule:** for political, religious and philosophical texts, blurbs describe what the work argues and why it matters, without endorsing or criticising it.
- **Covers:** simple generated SVG covers for now; AI cover art is deferred.
- **Recommender:** tag-based scoring first; embeddings are deferred. Explain (Labs) is deferred.
- **Online data:** none in R0–R2. R3 optional sync, if built, uses client-encrypted blobs on Cloudflare R2 or KV.
- **Offline:** new story "Auto-cache Your Shortlist"; caching is Workbox precache for the shell and catalog, runtime cache-first for texts, Dexie for reader data, and OPFS for future AI models.
- **Naming:** Twice Told and the labels in CONTEXT.md; the mock-up images in `docs/` still show old labels.
- **Initial build scope:** Your Long List (simplified US-501) and the Tonight's Shortlist title (6 pm–4 am) are in the initial build.
- **Enrichment:** `content/curation.json` (year, era band, form, genres, moods, content notes, hook, blurb) is written by Claude Code in the session from each story's own text, not by a build-time LLM call. Every record is marked `generatedBy: "claude-code"` and `reviewed: false` until a person reviews it. Reading speed is 238 words per minute (EN-204). Fiction of 7,500–17,499 words is a novelette and 17,500+ a novella; non-fiction is an essay. Reading level is the Flesch-Kincaid grade of the story's own text. The archaic-word glossary is deferred.
- **Reader:** foliate-js, pinned to exactly 1.0.1 from npm, behind a `ReaderEngine` interface in `src/engine/reader/`. Only that folder may import it. Stories that sit inside a collection are shown by hiding the text outside their href range. The reading fonts (Literata, Atkinson Hyperlegible, OpenDyslexic) are packaged with the app (no font CDN). The reader screen is at /read/:id.
- **Generated files:** `public/catalog`, `public/texts` and `public/covers` are rebuilt from `content/` by `npm run catalog` (run automatically before `dev` and `build`) and are not committed.
- **Backups:** manual JSON exports (Settings → Your data); there is no sync until R3.
- **Dev environment:** Windows, PowerShell.
