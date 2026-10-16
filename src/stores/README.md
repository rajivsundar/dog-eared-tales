# stores

Dexie stores. The only code allowed to touch IndexedDB.

Other code imports from `src/stores` (index.ts) and uses the interfaces in `types.ts`. It never imports Dexie. A lint rule enforces this.

| Store            | Job                                                                |
| ---------------- | ------------------------------------------------------------------ |
| `profileStore`   | The taste profile. A cache that can be rebuilt from the event log. |
| `eventLog`       | Append-only reader events with timestamps. The source of truth.    |
| `libraryStore`   | Works kept for later (Dog-eared in the app).                       |
| `progressStore`  | Reading position for each work.                                    |
| `highlightStore` | Highlights and notes.                                              |
| `settingsStore`  | Reading and display preferences.                                   |

## Changing the schema later

The schema lives in `db.ts`. To change it, add a new `this.version(n + 1).stores(...)` step (with `.upgrade(...)` if existing data must be converted). Leave older versions as they are.
