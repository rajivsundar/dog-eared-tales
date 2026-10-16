import type { CatalogEntry } from '../../catalog'
import {
  ONBOARD_START,
  ONBOARD_WORK,
  type CardAnswer,
  buildProfile,
  firstShortlist,
  onboardingAnswers,
} from '../../engine/recommend'
import type {
  EventLog,
  Profile,
  ProfileStore,
  ReaderEvent,
  SettingsStore,
} from '../../stores'
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
 * "Read a short story now": saves an empty profile, so the welcome page never shows again. The
 * reader's first rating (the check-in after the story) seeds the profile from there.
 */
export async function startWithStory(
  deps: Pick<OnboardingDeps, 'profile'>,
): Promise<void> {
  const existing = await deps.profile.get()
  if (existing) return
  await deps.profile.put({
    id: 'profile',
    tasteVector: [],
    facetBeliefs: {},
    ladderLevel: 0,
    wordsPerMinute: 238,
    version: 2,
  })
}

/** Appends onboarding events with explicit, rising times, so the order is exact. */
async function appendOnboardEvents(
  events: EventLog,
  base: number,
  items: { workId: string; reason: string }[],
): Promise<number> {
  let n = 0
  for (const item of items) {
    await events.append({
      workId: item.workId,
      type: 'onboard',
      reason: item.reason,
      at: base + n++,
    })
  }
  return n
}

/**
 * Rebuilds the profile from the event log and stores a fresh Your Shortlist for today: it leaves
 * out taste cards answered Not for me (for today only) and holds a Loved card if there was one.
 */
async function rebuildShortlist(
  deps: OnboardingDeps,
  cards: Record<string, CardAnswer>,
  now: Date,
  ladderLevel: number | undefined,
): Promise<Profile> {
  const [stored, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  const profile = buildProfile(deps.catalog, events, now.getTime() + 1000, {
    ladderLevel: ladderLevel ?? stored?.ladderLevel ?? 0,
  })
  await deps.profile.put(profile)

  const avoid = Object.entries(cards)
    .filter(([, a]) => a === 'notForMe')
    .map(([id]) => id)
  const loved = Object.entries(cards)
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
  return profile
}

/**
 * Ends onboarding. Writes the answers as events (a start marker, then the moods, then any cards),
 * rebuilds the profile from the event log, and stores the first Your Shortlist.
 * With no answers at all ("Skip") it records only the start marker, so the starter mix applies.
 */
export async function finishOnboarding(
  deps: OnboardingDeps,
  answers: OnboardingAnswers,
  now: Date = new Date(),
): Promise<void> {
  const base = now.getTime()
  await appendOnboardEvents(deps.events, base, [
    { workId: ONBOARD_WORK, reason: ONBOARD_START },
    ...answers.moods.map((mood) => ({
      workId: ONBOARD_WORK,
      reason: `mood:${mood}`,
    })),
    ...Object.entries(answers.cards).map(([workId, answer]) => ({
      workId,
      reason: answer,
    })),
  ])
  await rebuildShortlist(deps, answers.cards, now, answers.ladderLevel)
}

/**
 * "Tune your picks": saves the taste-card answers as events (with no new start marker, so the
 * moods picked earlier still count), then rebuilds today's shortlist at once.
 */
export async function tuneTaste(
  deps: OnboardingDeps,
  cards: Record<string, CardAnswer>,
  now: Date = new Date(),
): Promise<void> {
  await appendOnboardEvents(
    deps.events,
    now.getTime(),
    Object.entries(cards).map(([workId, answer]) => ({
      workId,
      reason: answer,
    })),
  )
  await rebuildShortlist(deps, cards, now, undefined)
}

/** The moods picked in the newest onboarding run, for choosing taste cards. */
export function pickedMoods(events: ReaderEvent[]): string[] {
  return onboardingAnswers(events).moods.map((m) => m.name)
}

/** Has the reader answered any taste cards in the newest onboarding run? */
export function hasAnsweredCards(events: ReaderEvent[]): boolean {
  return onboardingAnswers(events).cards.length > 0
}
