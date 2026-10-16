import type { CatalogEntry, LengthClass } from '../../catalog'
import type { Profile } from '../../stores'
import type { History } from './history'
import { WEIGHT_MAX, WEIGHT_MIN, netWeight } from './learn'

type Beliefs = Profile['facetBeliefs']

/** How much each part counts toward an entry's score. They add up to 1. */
export const WEIGHTS = {
  mood: 0.45,
  genre: 0.3,
  length: 0.15,
  novelty: 0.1,
} as const

export const LENGTH_CLASSES: readonly LengthClass[] = [
  'under10',
  '10to30',
  '30to60',
  '60plus',
]

/** Score for a length class that is 0, 1, 2 or 3 steps from the reader's preferred one. */
export const LENGTH_FIT = [1, 0.6, 0.3, 0.1] as const

/** After this many showings with no tap, an entry's score is halved. Halved again after each further set. */
export const SHOWN_WITHOUT_TAP_LIMIT = 3

/** An essay (or any pick) must score at least this to count as "scoring reasonably". */
export const REASONABLE_SCORE = 0.45

/**
 * A reader's weight for a mood, genre or length class, from 0 to 1. 0.5 means "no opinion yet".
 * The learned weight runs from WEIGHT_MIN (-5) to WEIGHT_MAX (+8): -5 is 0, 0 is 0.5, +8 is 1.
 */
export function facetWeight(beliefs: Beliefs, key: string): number {
  const net = netWeight(beliefs, key)
  return net >= 0
    ? 0.5 + (0.5 * net) / WEIGHT_MAX
    : 0.5 + (0.5 * net) / -WEIGHT_MIN
}

function average(numbers: number[]): number {
  return numbers.length === 0
    ? 0.5
    : numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

export function moodMatch(entry: CatalogEntry, beliefs: Beliefs): number {
  return average(entry.moods.map((m) => facetWeight(beliefs, `mood:${m}`)))
}

export function genreMatch(entry: CatalogEntry, beliefs: Beliefs): number {
  return average(entry.genres.map((g) => facetWeight(beliefs, `genre:${g}`)))
}

export function lengthFit(
  entryClass: LengthClass,
  preferred: LengthClass,
): number {
  const distance = Math.abs(
    LENGTH_CLASSES.indexOf(entryClass) - LENGTH_CLASSES.indexOf(preferred),
  )
  return LENGTH_FIT[Math.min(distance, LENGTH_FIT.length - 1)]
}

/** 1 if never shown, 0.5 after one showing, 0.33 after two. 0 if the reader has already started it. */
export function noveltyBonus(id: string, history: History): number {
  if (history.touched.has(id)) return 0
  return 1 / (1 + (history.timesShown.get(id) ?? 0))
}

/** 1 normally; 0.5 after 3 showings with no tap; 0.25 after 6. */
export function shownPenalty(id: string, history: History): number {
  const shown = history.shownSinceTap.get(id) ?? 0
  return 0.5 ** Math.floor(shown / SHOWN_WITHOUT_TAP_LIMIT)
}

/**
 * The length class the reader likes best. If they have finished or loved at least two stories, it is
 * the class they finish most (the shorter one on a tie). Otherwise it comes from the profile's ladder
 * level, and with neither it is "under 10 minutes".
 */
export function preferredLengthClass(
  catalog: CatalogEntry[],
  finishedIds: Iterable<string>,
  lovedIds: Iterable<string>,
  ladderLevel: number | undefined,
): LengthClass {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const counts = new Map<LengthClass, number>()
  let total = 0
  for (const id of [...finishedIds, ...lovedIds]) {
    const entry = byId.get(id)
    if (!entry) continue
    counts.set(entry.lengthClass, (counts.get(entry.lengthClass) ?? 0) + 1)
    total++
  }
  if (total >= 2) {
    let best: LengthClass = 'under10'
    let bestCount = -1
    for (const lengthClass of LENGTH_CLASSES) {
      const n = counts.get(lengthClass) ?? 0
      if (n > bestCount) {
        best = lengthClass
        bestCount = n
      }
    }
    return best
  }
  if (ladderLevel !== undefined) {
    const index = Math.min(
      LENGTH_CLASSES.length - 1,
      Math.max(0, Math.round(ladderLevel)),
    )
    return LENGTH_CLASSES[index]
  }
  return 'under10'
}

export interface ScoreParts {
  mood: number
  genre: number
  length: number
  novelty: number
  /** The 3-shown penalty: 1, 0.5, 0.25 … */
  penalty: number
}

export interface Scored {
  entry: CatalogEntry
  /** 0 to 1, after the penalty. */
  score: number
  parts: ScoreParts
}

export interface ScoreContext {
  beliefs: Beliefs
  preferred: LengthClass
  history: History
}

export function scoreEntry(
  entry: CatalogEntry,
  { beliefs, preferred, history }: ScoreContext,
): Scored {
  const parts: ScoreParts = {
    mood: moodMatch(entry, beliefs),
    genre: genreMatch(entry, beliefs),
    // The distance fit, scaled by how much the reader likes this length (x1 when neutral).
    length: Math.min(
      1,
      lengthFit(entry.lengthClass, preferred) *
        (0.5 + facetWeight(beliefs, `length:${entry.lengthClass}`)),
    ),
    novelty: noveltyBonus(entry.id, history),
    penalty: shownPenalty(entry.id, history),
  }
  const raw =
    WEIGHTS.mood * parts.mood +
    WEIGHTS.genre * parts.genre +
    WEIGHTS.length * parts.length +
    WEIGHTS.novelty * parts.novelty
  return { entry, score: raw * parts.penalty, parts }
}

/** Best first. Ties go to the lower id, so the order never changes between runs. */
export function byScoreThenId(a: Scored, b: Scored): number {
  return b.score - a.score || a.entry.id.localeCompare(b.entry.id)
}
