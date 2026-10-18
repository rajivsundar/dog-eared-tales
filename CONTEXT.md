# CONTEXT.md — Product context

**Name:** Dog-Eared Tales (a separate product, forked from Twice Told v1.0)

**Tagline:** "Free classics, picked for you. Start short. Fold down a corner when one gets you."

**About:** "A dog-ear is the folded corner of a page, the mark of a book somebody loved. Dog-Eared Tales is a place for stories worth turning down a corner for."

## Glossary

| UI label                       | Meaning                                              | Code term        | Former name           |
| ------------------------------ | ---------------------------------------------------- | ---------------- | --------------------- |
| Your Shortlist                 | the daily set of 6 picks                             | `shortlist`      | Today's Shelf         |
| Tonight's Shortlist            | the shortlist's title from 6 pm to 4 am              | `shortlist`      | Tonight's shelf       |
| Dog-ear / Dog-ear it for later | keep a work to read later (button / tooltip)         | `save`           | Save / Save for later |
| Kept                           | Library tab of dog-eared works (the first tab)       | `saved`          | Saved, Dog-eared      |
| Your Long List                 | row of longer works offered once the reader is ready | `longList`       | Longer reads          |
| Profiles / Profile             | one person's reading on this device (not an account) | `readingProfile` | —                     |
| Who's reading?                 | the screen that asks which profile to open           | `/who`           | —                     |
| Read as guest                  | a temporary profile that saves nothing               | `guest`          | —                     |

> A profile keeps reading separate on this device; it is not an account and does not lock anyone out. In code it is a `readingProfile`, so it is never confused with the taste `Profile`.

> Dog-ear saves a whole work for later; once done, the button reads "Dog-eared ✓". Reading position is saved automatically and is not a bookmark.

> Note: the mock-up images in `docs/` still show the old labels; CONTEXT.md wins.
