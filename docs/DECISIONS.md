# Decisions that override docs/SRS.md

Dated 2026-10-15.

- **Build process:** one assistant (Claude Code in VS Code), step-by-step prompts. No agent crew, Antigravity, gates (G0–G5, C1, C2) or Content Factory agents.
- **Code hosting:** private GitHub repo rajivsundar/twice-told; CI is GitHub Actions. No Gitea or Gitea Actions.
- **Deployment:** Cloudflare Workers static assets via `wrangler deploy`, replacing Cloudflare Pages Direct Upload (D10, EN-1203).
- **Branching:** work on `main`, with optional pull requests; no dev/test branches yet.
- **Catalog:** a hand-picked starter catalog of 28 entries from 24 unchanged Project Gutenberg EPUBs, defined in `content/sources.csv`. Stories inside collections are href ranges in the original file, not split files. The harvester (EN-202) and Standard Ebooks feeds are deferred.
- **Covers:** simple generated SVG covers for now; AI cover art is deferred.
- **Recommender:** tag-based scoring first; embeddings are deferred. Explain (Labs) is deferred.
- **Online data:** none in R0–R2. R3 optional sync, if built, uses client-encrypted blobs on Cloudflare R2 or KV.
- **Offline:** new story "Auto-cache Your Shortlist"; caching is Workbox precache for the shell and catalog, runtime cache-first for texts, Dexie for reader data, and OPFS for future AI models.
- **Naming:** Twice Told and the labels in CONTEXT.md; the mock-up images in `docs/` still show old labels.
- **Initial build scope:** Your Long List (simplified US-501) and the Tonight's Shortlist title (6 pm–4 am) are in the initial build.
- **Enrichment:** `content/curation.json` (year, era band, form, genres, moods, content notes, hook, blurb) is written by Claude Code in the session from each story's own text, not by a build-time LLM call. Every record is marked `generatedBy: "claude-code"` and `reviewed: false` until a person reviews it. Reading speed is 238 words per minute (EN-204). Fiction of 7,500–17,499 words is a novelette and 17,500+ a novella; non-fiction is an essay. Reading level is the Flesch-Kincaid grade of the story's own text. The archaic-word glossary is deferred.
- **Generated files:** `public/catalog`, `public/texts` and `public/covers` are rebuilt from `content/` by `npm run catalog` (run automatically before `dev` and `build`) and are not committed.
- **Dev environment:** Windows, PowerShell.
