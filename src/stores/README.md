# stores

Dexie stores. The only code allowed to touch IndexedDB.

Other code imports from `src/stores` (index.ts) and uses the interfaces in `types.ts`. It never imports Dexie. A lint rule enforces this.

| Store            | Job                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `profileStore`   | The taste profile. A cache that can be rebuilt from the event log.                                              |
| `eventLog`       | Append-only reader events with timestamps. The source of truth.                                                 |
| `libraryStore`   | Works kept for later (Dog-eared in the app).                                                                    |
| `progressStore`  | Reading position for each work.                                                                                 |
| `highlightStore` | Highlights and notes.                                                                                           |
| `settingsStore`  | Reading and display preferences.                                                                                |
| `dataStore`      | Export, replace and wipe the open profile (Settings → Your data).                                               |
| `profileManager` | The reading profiles: list, create, rename, recolour, switch, remove, guest, import and export of all profiles. |

## Changing the schema later

The schema lives in `db.ts`. To change it, add a new `this.version(n + 1).stores(...)` step (with `.upgrade(...)` if existing data must be converted). Leave older versions as they are.

## Reading profiles

Each reading profile has its own database (`twice-told-p-<id>`, the schema in `db.ts`); `twice-told-profiles` (`registry.ts`) lists them. `profileStore`, `eventLog`, `libraryStore`, `progressStore`, `highlightStore` and `settingsStore` are forwarders: each call goes to the profile that was open when it was made, and a switch waits for calls in flight. The old single `twice-told` database is migrated into a profile "Me" on first start (`profileManager.ts`, tested in `migration.test.ts`).
