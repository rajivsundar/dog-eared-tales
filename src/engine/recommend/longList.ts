import type { CatalogEntry } from '../../catalog'
import type { Profile, ReaderEvent } from '../../stores'
import { digestEvents } from './history'
import { netWeight, workStates } from './learn'
import { genreMatch, moodMatch } from './score'

type Beliefs = Profile['facetBeliefs']

export const LONG_LIST_SIZE = 4
/** Works finished and rated Loved it or It was OK before the Long List appears. */
export const POSITIVE_FINISHES_NEEDED = 3
/** A pick is rotated out once it has been shown on this many different days without a tap. */
export const ROTATE_AFTER_DAYS = 7
/** If the weight for the longest length class is below this, show at most one. */
export const STRONG_NEGATIVE = -2

const LONG_FORMS = new Set(['novelette', 'novella'])
const TAPS = new Set(['tap', 'open', 'save'])

/** The local calendar day of a time, as "YYYY-MM-DD". */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** How many works the reader finished and rated Loved it or It was OK (since any taste reset). */
export function positiveFinishes(events: ReaderEvent[]): number {
  let count = 0
  for (const state of workStates(events).values()) {
    if (
      state.finishedAt !== undefined &&
      (state.rating?.type === 'love' || state.rating?.type === 'ok')
    ) {
      count++
    }
  }
  return count
}

export function isLongListUnlocked(events: ReaderEvent[]): boolean {
  return positiveFinishes(events) >= POSITIVE_FINISHES_NEEDED
}

/** Works shown on 7 or more different days since the reader last tapped them. */
export function rotatedOut(events: ReaderEvent[]): Set<string> {
  const days = new Map<string, Set<string>>()
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.type === 'shown') {
      const set = days.get(e.workId) ?? new Set<string>()
      set.add(dayKey(e.at))
      days.set(e.workId, set)
    } else if (TAPS.has(e.type)) {
      days.delete(e.workId)
    }
  }
  return new Set(
    [...days]
      .filter(([, set]) => set.size >= ROTATE_AFTER_DAYS)
      .map(([id]) => id),
  )
}

export function isLongForm(entry: CatalogEntry): boolean {
  return LONG_FORMS.has(entry.form)
}

/** "You loved The Signal-Man — try a longer ghost story". */
export function longListReason(
  entry: CatalogEntry,
  catalog: CatalogEntry[],
  events: ReaderEvent[],
  beliefs: Beliefs,
): string {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const rated = [...workStates(events)]
    .filter(
      ([id, s]) =>
        s.finishedAt !== undefined &&
        (s.rating?.type === 'love' || s.rating?.type === 'ok') &&
        byId.has(id),
    )
    .sort((a, b) => (b[1].rating?.at ?? 0) - (a[1].rating?.at ?? 0))
  for (const [id, state] of rated) {
    const liked = byId.get(id)!
    const genre = liked.genres.find((g) => entry.genres.includes(g))
    const mood = liked.moods.find((m) => entry.moods.includes(m))
    const facet = genre ?? mood
    if (!facet) continue
    const verb = state.rating?.type === 'love' ? 'loved' : 'liked'
    const noun = facet.endsWith('story') ? facet : `${facet} story`
    return `You ${verb} ${liked.title} — try a longer ${noun}`
  }
  const mood = entry.moods.find((m) => netWeight(beliefs, `mood:${m}`) > 0)
  return mood
    ? `Matches your taste for ${mood} stories`
    : 'A longer read, for when you are ready'
}

export interface LongListInput {
  catalog: CatalogEntry[]
  profile: Pick<Profile, 'facetBeliefs'>
  events: ReaderEvent[]
  /** Works to leave out, such as today's shortlist. */
  avoid: string[]
  count?: number
}

export interface LongListPick {
  entry: CatalogEntry
  reason: string
}

/** Every eligible novelette or novella, best first. */
export function rankLongList(input: LongListInput): LongListPick[] {
  const { catalog, profile, events } = input
  const beliefs = profile.facetBeliefs
  const history = digestEvents(events)
  const skip = new Set([...input.avoid, ...rotatedOut(events)])
  return catalog
    .filter(
      (e) =>
        isLongForm(e) &&
        !history.finished.has(e.id) &&
        !history.notForMe.has(e.id) &&
        !skip.has(e.id),
    )
    .map((entry) => ({
      entry,
      // The same learned mood and genre weights as Your Shortlist, in the same 45 : 30 proportion.
      score: 0.6 * moodMatch(entry, beliefs) + 0.4 * genreMatch(entry, beliefs),
    }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => ({
      entry,
      reason: longListReason(entry, catalog, events, beliefs),
    }))
}

/** How many Long List cards to show: up to 4, or at most 1 if the reader dislikes the longest reads. */
export function longListSize(
  beliefs: Beliefs,
  wanted = LONG_LIST_SIZE,
): number {
  return netWeight(beliefs, 'length:60plus') < STRONG_NEGATIVE
    ? Math.min(wanted, 1)
    : wanted
}

/** Up to 4 novelettes or novellas for Your Long List, or none until it is unlocked. */
export function recommendLongList(input: LongListInput): LongListPick[] {
  if (!isLongListUnlocked(input.events)) return []
  const size = longListSize(input.profile.facetBeliefs, input.count)
  return rankLongList(input).slice(0, size)
}
