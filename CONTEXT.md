# CONTEXT.md — Product context

**Name:** Twice Told (formerly LuminaRead)

**Tagline:** "Great free stories, picked for you. Start short. Fall for the classics."

**About:** "Named after Nathaniel Hawthorne's Twice-Told Tales (1837) — stories worth telling again."

## Glossary

| UI label                       | Meaning                                              | Code term        | Former name           |
| ------------------------------ | ---------------------------------------------------- | ---------------- | --------------------- |
| Your Shortlist                 | the daily set of 6 picks                             | `shortlist`      | Today's Shelf         |
| Tonight's Shortlist            | the shortlist's title from 6 pm to 4 am              | `shortlist`      | Tonight's shelf       |
| Dog-ear / Dog-ear it for later | keep a work to read later (button / tooltip)         | `save`           | Save / Save for later |
| Dog-eared                      | Library tab of kept works                            | `saved`          | Saved                 |
| Your Long List                 | row of longer works offered once the reader is ready | `longList`       | Longer reads          |
| Profiles / Profile             | one person's reading on this device (not an account) | `readingProfile` | —                     |
| Who's reading?                 | the screen that asks which profile to open           | `/who`           | —                     |
| Read as guest                  | a temporary profile that saves nothing               | `guest`          | —                     |

> A profile keeps reading separate on this device; it is not an account and does not lock anyone out. In code it is a `readingProfile`, so it is never confused with the taste `Profile`.

> Dog-ear saves a whole work for later. Reading position is saved automatically and is not a bookmark.

> Note: the mock-up images in `docs/` still show the old labels; CONTEXT.md wins.
