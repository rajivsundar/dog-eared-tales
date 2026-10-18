# features/library

The Library at /library, with three tabs, in the order Kept, Reading, Finished (Kept is selected by default). Each work is in exactly one:

- **Kept** (tab id `dog-eared`): dog-eared, kept for later and not started. Opening a story is not starting it. Un-dog-ear records `unsave`, and Undo records `undo` with reason `unsave`.
- **Reading**: a page has been turned (saved progress above 0, below 100). Tapping resumes.
- **Finished**: has a `finished` event, unless the reader has started it again.

`libraryLists.ts` holds the sorting rules.
