# AGENTS.md — Project rules for Twice Told

## How we work

- I am new to coding. Before changing files, show a short plan in plain English and wait for my OK.
- Keep each change small. After each change, tell me exactly how to check it works.
- I work on Windows in PowerShell. Give me PowerShell commands.

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

## Secrets

- Never commit secrets. Use `.env` files listed in `.gitignore`.
