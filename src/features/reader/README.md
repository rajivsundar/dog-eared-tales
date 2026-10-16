# features/reader

The reading screen at `/read/:id`: the page the reader sees while reading a work.

It loads the catalog entry, opens its `textUrl` through the `ReaderEngine` (with `startHref` and `endHref` for a story inside a collection), and saves progress as the reader goes.

| File                 | Job                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `ReaderScreen.tsx`   | The screen: opens the story, tap zones, keys, header, progress bar, panels                       |
| `AaPanel.tsx`        | Font, text size (steps 1–10) and theme. Each change applies at once and is saved to the settings |
| `ProgressBar.tsx`    | The slim bar and "N min left in this story"                                                      |
| `EndScreen.tsx`      | "You finished it" and Back to Your Shortlist                                                     |
| `progressTracker.ts` | Saves the position on every page turn and logs open, progress and finished events                |

## What gets saved

- **Every page turn:** the position (locator), percent and seconds read go to the progress store. Time between turns counts as reading time, up to 2 minutes per turn.
- **Events:** `open` when a story opens, `progress` each time the reader passes another tenth of the story, `finished` at the end.
- **Reopening:** a story reopens where the reader left off. A finished story starts again from the beginning.
