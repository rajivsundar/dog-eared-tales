import type { CatalogEntry } from '../../catalog'
import {
  ONBOARD_START,
  ONBOARD_WORK,
  buildProfile,
  firstShortlist,
  type CardAnswer,
} from '../../engine/recommend'
import type { EventLog, ProfileStore, SettingsStore } from '../../stores'
import { saveFirstShortlist } from '../shortlist/dailyShortlist'

export interface OnboardingDeps {
  catalog: CatalogEntry[]
  events: EventLog
  profile: ProfileStore
  settings: SettingsStore
}

export interface OnboardingAnswers {
  /** The moods picked on the mood board. Empty when the reader skipped it. */
  moods: string[]
  /** Taste-card answers, by work id. */
  cards: Record<string, CardAnswer>
  /** A starting length preference (0 = under 10 minutes ... 3 = over an hour), if given. */
  ladderLevel?: number
}

/** True for a reader with no profile and no events: onboarding shows only then. */
export async function isFirstRun(
  deps: Pick<OnboardingDeps, 'events' | 'profile'>,
): Promise<boolean> {
  const [profile, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  return !profile && events.length === 0
}

/**
 * Ends onboarding. Writes the answers as events (a start marker, then the moods, then the cards),
 * rebuilds the profile from the event log, and stores the first Your Shortlist: it leaves out the
 * cards answered Not for me for today, and holds a Loved card if there was one.
 * With no answers at all ("Skip setup") it records only the start marker, so the starter mix applies.
 */
export async function finishOnboarding(
  deps: OnboardingDeps,
  answers: OnboardingAnswers,
  now: Date = new Date(),
): Promise<void> {
  // Explicit, rising times keep the order exact however fast the writes are.
  const base = now.getTime()
  let n = 0
  const append = (workId: string, reason: string) =>
    deps.events.append({ workId, type: 'onboard', reason, at: base + n++ })

  await append(ONBOARD_WORK, ONBOARD_START)
  for (const mood of answers.moods) await append(ONBOARD_WORK, `mood:${mood}`)
  for (const [workId, answer] of Object.entries(answers.cards)) {
    await append(workId, answer)
  }

  const [stored, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  const profile = buildProfile(deps.catalog, events, base + n, {
    ladderLevel: answers.ladderLevel ?? stored?.ladderLevel ?? 0,
  })
  await deps.profile.put(profile)

  const avoid = Object.entries(answers.cards)
    .filter(([, a]) => a === 'notForMe')
    .map(([id]) => id)
  const loved = Object.entries(answers.cards)
    .filter(([, a]) => a === 'love')
    .map(([id]) => id)
  const picks = firstShortlist({
    catalog: deps.catalog,
    profile,
    events,
    avoid,
    loved,
  })
  await saveFirstShortlist(
    deps,
    picks.map((p) => ({ entry: p.entry, reason: p.reason })),
    avoid,
    now,
  )
}
