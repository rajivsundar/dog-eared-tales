# AGENTS.md — Project rules for Dog-Eared Tales

## How we work

- I am new to coding. Before changing files, show a short plan in plain English and wait for my OK.
- Keep each change small. After each change, tell me exactly how to check it works.
- I work on Windows in PowerShell. Give me PowerShell commands.

## Running checks

- During a step, run only what the change touches: `npm run typecheck`, `npm run lint`, the Vitest tests related to the changed files (`npx vitest related --run <files>`), and only the affected Playwright specs (`npx playwright test e2e/<name>.spec.ts`).
- Run the full suite (`npm test` and `npm run e2e`) once, just before committing. GitHub Actions runs everything on every push anyway.
- Playwright starts and stops its own preview server (`scripts/e2e-server.mjs`); it never reuses a server it did not start. If port 4173 is busy, it says so and stops. Do not start extra preview servers by hand, and stop any you did start before running the tests.
- Waiting in end-to-end tests is done with `expect` (or `expect.poll`), never with fixed `waitForTimeout` pauses.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Dexie for IndexedDB
- vite-plugin-pwa (Workbox)
- Vitest and Playwright for testing

## Architecture and privacy

- The app is client-only. No server, no online database, no analytics, no tracking. Reader data stays on the device.
- Only `src/stores/` may touch IndexedDB.

## Content

- Never invent or paraphrase book text. Book texts only come from files in `content/`.
- All user-facing text uses the UI labels in CONTEXT.md; code uses the code terms listed there.

## Reference and hosting

- `docs/SRS.md` is the product reference. Ignore its parts about agents, Antigravity, Gitea and gates; we build step by step with one assistant, host code on GitHub and deploy to Cloudflare Workers static assets.
- docs/DECISIONS.md overrides docs/SRS.md wherever they conflict.

## Secrets

- Never commit secrets. Use `.env` files listed in `.gitignore`.
