import type { CatalogEntry } from '../../catalog'
import { digestEvents } from './history'
import type { History } from './history'
import { personalReason, starterReason } from './reasons'
import {
  REASONABLE_SCORE,
  byScoreThenId,
  facetWeight,
  lengthFit,
  noveltyBonus,
  preferredLengthClass,
  scoreEntry,
  shownPenalty,
} from './score'
import type { Scored } from './score'
import type {
  RecommendInput,
  RecommendResult,
  Recommendation,
  Slot,
} from './types'

export const DEFAULT_COUNT = 6

/** A mood counts as "picked" when the reader's weight for it is above this. */
const PICKED = 0.5

function eligible(catalog: CatalogEntry[], history: History): CatalogEntry[] {
  return catalog.filter(
    (e) => !history.finished.has(e.id) && !history.notForMe.has(e.id),
  )
}

function hasBeliefs(input: RecommendInput): boolean {
  return Object.keys(input.profile?.facetBeliefs ?? {}).length > 0
}

/** Returns Your Shortlist: up to `count` picks, each with a one-line reason. */
export function recommend(input: RecommendInput): RecommendResult {
  const count = input.count ?? DEFAULT_COUNT
  const history = digestEvents(input.events)
  const pool = eligible(input.catalog, history)
  return hasBeliefs(input)
    ? { mode: 'personal', picks: personalPicks(input, pool, history, count) }
    : { mode: 'starter', picks: starterPicks(pool, history, count) }
}

function personalPicks(
  input: RecommendInput,
  pool: CatalogEntry[],
  history: History,
  count: number,
): Recommendation[] {
  const beliefs = input.profile?.facetBeliefs ?? {}
  const lovedIds = input.events
    .filter((e) => e.type === 'love')
    .map((e) => e.workId)
  const preferred = preferredLengthClass(
    input.catalog,
    history.finished,
    lovedIds,
    input.profile?.ladderLevel,
  )
  const ranked = pool
    .map((e) => scoreEntry(e, { beliefs, preferred, history }))
    .sort(byScoreThenId)

  const chosen = new Map<string, { scored: Scored; slots: Set<Slot> }>()
  const take = (scored: Scored | undefined, slot: Slot) => {
    if (!scored || chosen.size >= count) return
    const existing = chosen.get(scored.entry.id)
    if (existing) existing.slots.add(slot)
    else chosen.set(scored.entry.id, { scored, slots: new Set([slot]) })
  }
  const satisfied = (test: (e: CatalogEntry) => boolean) =>
    [...chosen.values()].some((c) => test(c.scored.entry))

  // Wildcard: an entry whose moods are all ones the reader has not picked.
  const unpicked = (e: CatalogEntry) =>
    e.moods.length > 0 &&
    e.moods.every((m) => facetWeight(beliefs, `mood:${m}`) <= PICKED)
  const someUnpicked = (e: CatalogEntry) =>
    e.moods.some((m) => facetWeight(beliefs, `mood:${m}`) <= PICKED)
  take(
    ranked.find((s) => unpicked(s.entry)) ??
      ranked.find((s) => someUnpicked(s.entry)),
    'wildcard',
  )

  // At least one essay, when any essay scores reasonably.
  const isEssay = (e: CatalogEntry) => e.form === 'essay'
  if (!satisfied(isEssay)) {
    take(
      ranked.find((s) => isEssay(s.entry) && s.score >= REASONABLE_SCORE),
      'essay',
    )
  }

  // At least one under 10 minutes.
  const isShort = (e: CatalogEntry) => e.lengthClass === 'under10'
  if (!satisfied(isShort))
    take(
      ranked.find((s) => isShort(s.entry)),
      'short',
    )

  // The rest are the best matches.
  for (const s of ranked) {
    if (chosen.size >= count) break
    take(s, 'match')
  }

  // Slots an entry fills without having been chosen for them.
  return [...chosen.values()]
    .map(({ scored, slots }) => {
      if (isShort(scored.entry)) slots.add('short')
      if (isEssay(scored.entry)) slots.add('essay')
      const list = [...slots]
      return {
        entry: scored.entry,
        score: scored.score,
        slots: list,
        reason: personalReason(scored.entry, beliefs, list),
      }
    })
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
}

/**
 * A balanced starter mix for a reader with no profile yet: at least one short story, at least one
 * essay, and the rest chosen to cover as many different moods and genres as possible, short first.
 */
function starterPicks(
  pool: CatalogEntry[],
  history: History,
  count: number,
): Recommendation[] {
  const base = (e: CatalogEntry) =>
    (0.5 * lengthFit(e.lengthClass, 'under10') +
      0.5 * noveltyBonus(e.id, history)) *
    shownPenalty(e.id, history)
  const best = (list: CatalogEntry[], covered: Set<string>) => {
    let top: CatalogEntry | undefined
    let topValue = -1
    for (const e of list) {
      const fresh = facets(e).filter((f) => !covered.has(f)).length
      const value = (fresh + 1) * base(e)
      if (value > topValue || (value === topValue && top && e.id < top.id)) {
        top = e
        topValue = value
      }
    }
    return top
  }

  const picks: CatalogEntry[] = []
  const covered = new Set<string>()
  const add = (e: CatalogEntry | undefined) => {
    if (!e || picks.length >= count || picks.includes(e)) return
    picks.push(e)
    for (const f of facets(e)) covered.add(f)
  }
  const rest = () => pool.filter((e) => !picks.includes(e))

  add(
    best(
      rest().filter((e) => e.lengthClass === 'under10'),
      covered,
    ),
  )
  add(
    best(
      rest().filter((e) => e.form === 'essay'),
      covered,
    ),
  )
  while (picks.length < count && rest().length > 0) add(best(rest(), covered))

  return picks.map((entry) => {
    const slots: Slot[] = ['starter']
    if (entry.lengthClass === 'under10') slots.push('short')
    if (entry.form === 'essay') slots.push('essay')
    return { entry, score: base(entry), slots, reason: starterReason(entry) }
  })
}

function facets(e: CatalogEntry): string[] {
  return [
    ...e.moods.map((m) => `mood:${m}`),
    ...e.genres.map((g) => `genre:${g}`),
  ]
}
