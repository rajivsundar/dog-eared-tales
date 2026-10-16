# features/onboarding

First-run onboarding at `/welcome`. It shows when there is no profile and no events (`FirstRunGate`).

- **Welcome** (`WelcomeHero`): a fan of 3 real covers, a headline from `src/app/seasons.ts`, "Read a short story now" (or the season's button) and "Pick my moods first". The season decides the words, the featured story (always under 10 minutes) and the covers; outside a season the defaults apply.
- **Read a short story now**: saves an empty profile (so the welcome never returns) and opens the featured story in the reader. The check-in after the story seeds the profile, and the first Your Shortlist is built from it.
- **Pick my moods first**: the mood board, then Your Shortlist. Skip goes straight to the starter mix.
- **Tune your picks**: after the first finished story, a dismissible card at the top of Your Shortlist opens `/tune` (the taste cards). The answers are saved without a new start marker, and today's shortlist is rebuilt at once.
- **Redo onboarding** (Settings, `/welcome?redo=1`): the full flow, with moods, taste cards and reading context.

Answers are `onboard` events (a start marker, picked moods, card answers). The profile is rebuilt from the event log, and Redo never deletes reading history.
