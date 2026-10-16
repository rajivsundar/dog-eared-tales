import type { CatalogEntry } from '../../catalog'
import type { Profile, ReaderEvent } from '../../stores'
import { recommend } from './recommend'
import type { Recommendation, Slot } from './types'

export interface FirstShortlistInput {
  catalog: CatalogEntry[]
  profile: Pick<Profile, 'facetBeliefs' | 'ladderLevel'>
  events: ReaderEvent[]
  /** Taste cards answered Not for me: kept off this first list only. */
  avoid: string[]
  /** Taste cards answered Love. */
  loved: string[]
}

const SLOTS: Slot[] = ['wildcard', 'essay', 'short']

/**
 * The first Your Shortlist, built when onboarding finishes. It leaves out the taste cards the
 * reader said Not for me to, and holds at least one card they Loved, if there was one.
 */
export function firstShortlist(input: FirstShortlistInput): Recommendation[] {
  const { catalog, profile, events, avoid, loved } = input
  const base = recommend({ catalog, profile, events, exclude: avoid }).picks
  const isLoved = (p: Recommendation) => loved.includes(p.entry.id)
  if (loved.length === 0 || base.some(isLoved)) return base

  const everything = recommend({
    catalog,
    profile,
    events,
    exclude: avoid,
    count: catalog.length,
  }).picks
  const best = everything.find(isLoved)
  if (!best) return base

  // Replace the lowest-scoring pick that is not the only one filling a slot.
  const needed = (p: Recommendation): boolean =>
    p.slots.some(
      (slot) =>
        SLOTS.includes(slot) &&
        !base.some((other) => other !== p && other.slots.includes(slot)),
    )
  const candidates = [...base].sort((a, b) => a.score - b.score)
  const out = candidates.find((p) => !needed(p)) ?? candidates[0]
  if (!out) return [best]
  const inserted: Recommendation = {
    ...best,
    reason: 'You loved the look of this one',
  }
  return base.map((p) => (p === out ? inserted : p))
}
