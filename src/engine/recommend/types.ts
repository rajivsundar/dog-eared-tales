import type { CatalogEntry } from '../../catalog'
import type { Profile, ReaderEvent } from '../../stores'

export interface RecommendInput {
  catalog: CatalogEntry[]
  /**
   * The reader's taste. Only the facet beliefs ("mood:eerie", "genre:horror") and the ladder level
   * are used. Leave it out, or leave the beliefs empty, for a starter mix.
   */
  profile?: Pick<Profile, 'facetBeliefs' | 'ladderLevel'> | null
  /** Everything in the event log. */
  events: ReaderEvent[]
  /** How many picks to return. Defaults to 6. */
  count?: number
}

/** Why a pick is on the shortlist. A pick can fill more than one slot. */
export type Slot = 'match' | 'wildcard' | 'short' | 'essay' | 'starter'

export interface Recommendation {
  entry: CatalogEntry
  /** 0 to 1. For a starter mix it measures how varied and short the pick is, not taste. */
  score: number
  slots: Slot[]
  /** One line for the card, such as "Because you like eerie stories". */
  reason: string
}

export interface RecommendResult {
  /** "starter" when there is no taste profile yet. */
  mode: 'personal' | 'starter'
  picks: Recommendation[]
}
