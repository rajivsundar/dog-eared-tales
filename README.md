# Twice Told

**Great free stories, picked for you. Start short. Fall for the classics.**

Named after Nathaniel Hawthorne's Twice-Told Tales (1837) — stories worth telling again.

## How to run the app

Requires Node.js (LTS). In PowerShell, from this folder:

```powershell
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the app locally         |
| `npm run build`     | Build the site into `dist/`   |
| `npm run preview`   | Serve the built site locally  |
| `npm test`          | Unit tests (Vitest)           |
| `npm run e2e`       | End-to-end tests (Playwright) |
| `npm run lint`      | Check code style              |
| `npm run typecheck` | Check TypeScript types        |

The first time you run `npm run e2e`, run `npx playwright install chromium` once to download the test browser.
