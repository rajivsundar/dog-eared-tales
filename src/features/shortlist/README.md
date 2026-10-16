# features/shortlist

Your Shortlist (Tonight's Shortlist from 6 pm to 4 am): today's 6 picks on the home page.

- `dailyShortlist.ts` keeps the picks for the local day (in the settings store), records `shown` once per story per day, and handles Dog-ear, Not for me and Undo.
- `ShortlistScreen.tsx` is the screen. The detail sheet is in `features/detail/`.
- `fakeStores.ts` is for tests only.
