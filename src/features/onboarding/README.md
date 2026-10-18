# features/onboarding

First-run onboarding at `/welcome`. It shows when there is no profile and no events (`FirstRunGate`).

- **Welcome** (`WelcomeHero`): a fan of 3 real covers, the sleeping-dog drawing (`src/app/welcomeArt/SleepingDog.tsx`, all year; in fall only the falling leaves are added), a headline from `src/app/seasons.ts`, "What are you in the mood for?" with six mood buttons (`FIRST_RUN_MOODS` in `moods.ts`: Funny, Eerie, Tense, Thoughtful, Adventurous, Hopeful) and a smaller "Surprise me" link. The season decides the words, the featured story (always under 10 minutes) and the covers; outside a season the defaults apply.
- **One tap on a mood**: records the start marker and `mood:<id>`, builds a personal first Your Shortlist from that mood (one wildcard outside it, plus a short story and an essay) and goes straight to it. No board, cards or reading context.
- **Surprise me**: saves an empty profile (so the welcome never returns) and opens the featured story in the reader. The check-in after the story seeds the profile, and the first Your Shortlist is built from it.
- **Guests** skip the welcome and see the starter mix, as before.
- **Tune your picks**: after the first finished story, a dismissible card at the top of Your Shortlist opens `/tune` (the taste cards). The answers are saved without a new start marker, and today's shortlist is rebuilt at once.
- **Redo onboarding** (Settings, `/welcome?redo=1`): the full flow, starting at the 12-mood board, with moods, taste cards and reading context.

Answers are `onboard` events (a start marker, picked moods, card answers). The profile is rebuilt from the event log, and Redo never deletes reading history.
