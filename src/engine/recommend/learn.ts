import type { CatalogEntry } from '../../catalog'
import type { Profile, ReaderEvent } from '../../stores'

/** Learning from the event log: moods, genres and lengths the reader likes or does not. */

/** An event's push halves every this many days. */
export const HALF_LIFE_DAYS = 60
/** Each mood, genre and length weight stays between these, after ageing. */
export const WEIGHT_MIN = -5
export const WEIGHT_MAX = 8
/** Leave a story before this much is read and it counts as a stop; at or above it counts as finished. */
export const FINISHED_FRACTION = 0.9
/** A story left unread this long (and not finished) counts as stopped. */
export const STOP_AFTER_DAYS = 7

/** How hard each thing pushes. A finished story always pushes +1; a rating adds to that. */
export const PUSH = {
  finished: 1,
  love: 2,
  ok: 0,
  notForMe: -2,
  save: 0.75,
  stopped: -0.5,
  /** "Too dark" also nudges the story's own other moods, a little. */
  tooDarkOtherMoods: -0.5,
  /** "Too old-fashioned" is a mild dip for everything about the story. */
  tooOldFashioned: -0.5,
} as const

export const NOT_FOR_ME_REASONS = [
  { id: 'too-long', label: 'Too long' },
  { id: 'not-my-genre', label: 'Not my genre' },
  { id: 'too-old-fashioned', label: 'Too old-fashioned' },
  { id: 'too-dark', label: 'Too dark' },
  { id: 'already-read', label: 'Already read' },
] as const
export type NotForMeReason = (typeof NOT_FOR_ME_REASONS)[number]['id']

const DAY_MS = 24 * 60 * 60 * 1000

export function clampWeight(value: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, value))
}

/** 1 for something that just happened, 0.5 after 60 days, 0.25 after 120. */
export function ageFactor(at: number, now: number): number {
  const days = Math.max(0, now - at) / DAY_MS
  return 0.5 ** (days / HALF_LIFE_DAYS)
}

interface WorkState {
  finishedAt?: number
  stoppedAt?: number
  rating?: { type: 'love' | 'ok' | 'notForMe'; at: number; reason?: string }
  saved: boolean
  savedAt?: number
}

/** The events since the last taste reset. */
export function eventsSinceReset(events: ReaderEvent[]): ReaderEvent[] {
  const inOrder = [...events].sort((a, b) => a.at - b.at)
  let start = 0
  inOrder.forEach((e, i) => {
    if (e.type === 'reset') start = i + 1
  })
  return inOrder.slice(start)
}

/** What happened to each work, after undos are applied. */
export function workStates(events: ReaderEvent[]): Map<string, WorkState> {
  const states = new Map<string, WorkState>()
  for (const e of eventsSinceReset(events)) {
    const s = states.get(e.workId) ?? { saved: false }
    states.set(e.workId, s)
    switch (e.type) {
      case 'finished':
        s.finishedAt = e.at
        s.stoppedAt = undefined
        break
      case 'stopped':
        if (s.finishedAt === undefined || s.finishedAt < e.at)
          s.stoppedAt = e.at
        break
      case 'love':
      case 'ok':
      case 'notForMe':
        s.rating = { type: e.type, at: e.at, reason: e.reason }
        break
      case 'save':
        s.saved = true
        s.savedAt = e.at
        break
      case 'unsave':
        s.saved = false
        break
      case 'undo':
        if (e.reason === 'unsave') {
          if (s.savedAt !== undefined) s.saved = true
        } else if (s.rating?.type === 'notForMe') {
          s.rating = undefined
        }
        break
      default:
        break
    }
  }
  return states
}

/** The latest rating (Loved it, It was OK or Not for me) a work has, if any. */
export function ratingOf(
  events: ReaderEvent[],
  workId: string,
): 'love' | 'ok' | 'notForMe' | undefined {
  return workStates(events.filter((e) => e.workId === workId)).get(workId)
    ?.rating?.type
}

type Pusher = (keys: string[], push: number, at: number) => void

function addRating(
  rating: NonNullable<WorkState['rating']>,
  moods: string[],
  genres: string[],
  length: string[],
  add: Pusher,
): void {
  const all = [...moods, ...genres, ...length]
  if (rating.type === 'love') return add(all, PUSH.love, rating.at)
  if (rating.type === 'ok') return add(all, PUSH.ok, rating.at)
  const push = PUSH.notForMe
  switch (rating.reason as NotForMeReason | undefined) {
    case 'too-long':
      return add(length, push, rating.at)
    case 'not-my-genre':
      return add(genres, push, rating.at)
    case 'too-dark':
      add(['mood:dark'], push, rating.at)
      return add(
        moods.filter((m) => m !== 'mood:dark'),
        PUSH.tooDarkOtherMoods,
        rating.at,
      )
    case 'too-old-fashioned':
      return add([...moods, ...genres], PUSH.tooOldFashioned, rating.at)
    case 'already-read':
      return // says nothing about taste
    default:
      return add(all, push, rating.at)
  }
}

/**
 * Builds the taste profile from the event log. Every event pushes the moods, genres and length
 * class of its story up or down; older events count less. Each weight is then kept between
 * WEIGHT_MIN and WEIGHT_MAX. The result is stored as success (positive) or failure (negative).
 */
export function buildProfile(
  catalog: CatalogEntry[],
  events: ReaderEvent[],
  now: number,
  base?: Pick<Profile, 'ladderLevel'>,
): Profile {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const sums = new Map<string, number>()
  const add: Pusher = (keys, push, at) => {
    const scaled = push * ageFactor(at, now)
    for (const key of keys) sums.set(key, (sums.get(key) ?? 0) + scaled)
  }

  for (const [workId, state] of workStates(events)) {
    const entry = byId.get(workId)
    if (!entry) continue
    const moods = entry.moods.map((m) => `mood:${m}`)
    const genres = entry.genres.map((g) => `genre:${g}`)
    const length = [`length:${entry.lengthClass}`]
    const all = [...moods, ...genres, ...length]
    if (state.finishedAt !== undefined)
      add(all, PUSH.finished, state.finishedAt)
    if (state.rating) addRating(state.rating, moods, genres, length, add)
    if (state.saved && state.savedAt !== undefined)
      add(all, PUSH.save, state.savedAt)
    if (state.stoppedAt !== undefined) add(all, PUSH.stopped, state.stoppedAt)
  }

  const facetBeliefs: Profile['facetBeliefs'] = {}
  for (const [key, sum] of sums) {
    const net = Math.round(clampWeight(sum) * 1000) / 1000
    if (net === 0) continue
    facetBeliefs[key] = {
      success: Math.max(net, 0),
      failure: Math.max(-net, 0),
    }
  }
  return {
    id: 'profile',
    tasteVector: [],
    facetBeliefs,
    ladderLevel: base?.ladderLevel ?? 0,
    wordsPerMinute: 238,
    version: 2,
  }
}

/** The signed weight of one facet, such as "mood:eerie". 0 when nothing is known. */
export function netWeight(
  beliefs: Profile['facetBeliefs'],
  key: string,
): number {
  const belief = beliefs[key]
  return belief ? clampWeight(belief.success - belief.failure) : 0
}

/** The strongest liked moods and genres, for the "Your taste" screen. */
export function topFacets(
  beliefs: Profile['facetBeliefs'],
  kind: 'mood' | 'genre',
  count = 5,
): { name: string; weight: number }[] {
  return Object.keys(beliefs)
    .filter((k) => k.startsWith(`${kind}:`))
    .map((k) => ({
      name: k.slice(kind.length + 1),
      weight: netWeight(beliefs, k),
    }))
    .filter((f) => f.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, count)
}
