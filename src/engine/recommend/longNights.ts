import type { CatalogEntry } from '../../catalog'
import type { Profile, ReaderEvent } from '../../stores'
import { digestEvents } from './history'
import { netWeight } from './learn'
import { genreMatch, moodMatch } from './score'
import { genreSingular, moodPlural } from './wording'

/** Tales for Longer Nights: the seasonal row of eerie fiction on Your Shortlist. */

export const LONG_NIGHTS_SIZE = 6

const FICTION = new Set(['story', 'novelette', 'novella'])

/**
 * Fiction (a story, novelette or novella, never an essay) that is eerie, a ghost story or horror.
 * "Dark" counts only next to horror or mystery, so a dark satire such as A Modest Proposal stays out.
 * Science fiction stays out too, unless it is also horror or a ghost story (so The Time Machine is out).
 */
export function isLongNightsTale(entry: CatalogEntry): boolean {
  if (!FICTION.has(entry.form)) return false
  const has = (genre: string): boolean => entry.genres.includes(genre)
  if (has('science fiction') && !has('horror') && !has('ghost story')) {
    return false
  }
  return (
    entry.moods.includes('eerie') ||
    has('ghost story') ||
    has('horror') ||
    (entry.moods.includes('dark') && has('mystery'))
  )
}

export interface LongNightsInput {
  catalog: CatalogEntry[]
  profile: Pick<Profile, 'facetBeliefs'>
  events: ReaderEvent[]
  /** Works to leave out. */
  avoid?: string[]
  /** Put first, if the reader has not finished it. */
  featuredId?: string
  featuredReason?: string
  count?: number
}

export interface LongNightsPick {
  entry: CatalogEntry
  reason: string
}

function reasonFor(
  entry: CatalogEntry,
  beliefs: Pick<Profile, 'facetBeliefs'>['facetBeliefs'],
): string {
  const mood = entry.moods.find((m) => netWeight(beliefs, `mood:${m}`) > 0)
  if (mood) return `Matches your taste for ${moodPlural(mood, entry.form)}`
  const genre =
    entry.genres.find((g) => g === 'ghost story' || g === 'horror') ??
    entry.genres[0]
  return `A ${genreSingular(genre, entry.form)} for a longer night`
}

/** Every eligible tale, best first, with the featured one in front. */
export function rankLongNights(input: LongNightsInput): LongNightsPick[] {
  const beliefs = input.profile.facetBeliefs
  const history = digestEvents(input.events)
  const skip = new Set(input.avoid ?? [])
  const ranked = input.catalog
    .filter(
      (e) =>
        isLongNightsTale(e) &&
        !history.finished.has(e.id) &&
        !history.notForMe.has(e.id) &&
        !skip.has(e.id),
    )
    .map((entry) => ({
      entry,
      // The same learned mood and genre weights as Your Shortlist and Your Long List.
      score: 0.6 * moodMatch(entry, beliefs) + 0.4 * genreMatch(entry, beliefs),
    }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => ({ entry, reason: reasonFor(entry, beliefs) }))

  const featured = ranked.findIndex((p) => p.entry.id === input.featuredId)
  if (featured > 0) {
    const [pick] = ranked.splice(featured, 1)
    ranked.unshift(pick)
  }
  if (featured >= 0 && input.featuredReason) {
    ranked[0] = { ...ranked[0], reason: input.featuredReason }
  }
  return ranked
}

/** Up to 6 tales for the row. */
export function recommendLongNights(input: LongNightsInput): LongNightsPick[] {
  return rankLongNights(input).slice(0, input.count ?? LONG_NIGHTS_SIZE)
}
