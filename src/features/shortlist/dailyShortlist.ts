import type { CatalogEntry } from '../../catalog'
import {
  FINISHED_FRACTION,
  STOP_AFTER_DAYS,
  buildProfile,
  digestEvents,
  recommend,
} from '../../engine/recommend'
import type {
  EventLog,
  Profile,
  ProfileStore,
  ProgressStore,
  SettingsStore,
} from '../../stores'

export interface ShortlistPick {
  entry: CatalogEntry
  reason: string
}

export interface ShortlistDeps {
  catalog: CatalogEntry[]
  settings: SettingsStore
  profile: ProfileStore
  events: EventLog
  progress: ProgressStore
}

/** The local calendar day as "YYYY-MM-DD". */
export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** "Tonight's Shortlist" from 6 pm to 4 am local time, otherwise "Your Shortlist". */
export function shortlistTitle(date: Date): string {
  const hour = date.getHours()
  return hour >= 18 || hour < 4 ? "Tonight's Shortlist" : 'Your Shortlist'
}

/** Works kept off today's list, from the taste cards answered Not for me. Only lasts for the day. */
async function todaysAvoid(
  deps: Pick<ShortlistDeps, 'settings'>,
  now: Date,
): Promise<string[]> {
  const stored = (await deps.settings.get()).shortlist
  return stored && stored.date === localDay(now) ? (stored.avoid ?? []) : []
}

async function save(
  deps: ShortlistDeps,
  picks: ShortlistPick[],
  now: Date,
  avoid?: string[],
): Promise<void> {
  const keep = avoid ?? (await todaysAvoid(deps, now))
  await deps.settings.update({
    shortlist: {
      date: localDay(now),
      picks: picks.map((p) => ({ workId: p.entry.id, reason: p.reason })),
      ...(keep.length > 0 ? { avoid: keep } : {}),
    },
  })
}

/** Stores the first list made when onboarding finishes, with the works to keep off it today. */
export async function saveFirstShortlist(
  deps: Pick<ShortlistDeps, 'settings'>,
  picks: ShortlistPick[],
  avoid: string[],
  now: Date,
): Promise<void> {
  await deps.settings.update({
    shortlist: {
      date: localDay(now),
      picks: picks.map((p) => ({ workId: p.entry.id, reason: p.reason })),
      ...(avoid.length > 0 ? { avoid } : {}),
    },
  })
}

/** The taste profile as the event log says it is right now. */
async function freshProfile(
  deps: ShortlistDeps,
  now: Date,
): Promise<{
  profile: Profile
  events: Awaited<ReturnType<EventLog['list']>>
}> {
  const [stored, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  return {
    profile: buildProfile(deps.catalog, events, now.getTime(), stored),
    events,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Called whenever the shortlist opens. A story left at 90% or more counts as finished, and one
 * left before 90% and not opened for 7 days counts as stopped. Each is logged once.
 */
export async function sweepStops(
  deps: Pick<ShortlistDeps, 'events' | 'progress'>,
  now: Date,
): Promise<void> {
  const [progress, events] = await Promise.all([
    deps.progress.list(),
    deps.events.list(),
  ])
  const lastAt = (workId: string, type: string): number =>
    Math.max(
      0,
      ...events
        .filter((e) => e.workId === workId && e.type === type)
        .map((e) => e.at),
    )
  for (const p of progress) {
    if (p.percent <= 0 || p.percent >= 100) continue
    if (lastAt(p.workId, 'finished') >= p.updatedAt) continue
    if (p.percent >= FINISHED_FRACTION * 100) {
      await deps.events.append({
        workId: p.workId,
        type: 'finished',
        value: p.percent / 100,
        at: p.updatedAt,
      })
    } else if (
      now.getTime() - p.updatedAt >= STOP_AFTER_DAYS * DAY_MS &&
      lastAt(p.workId, 'stopped') < p.updatedAt
    ) {
      await deps.events.append({
        workId: p.workId,
        type: 'stopped',
        value: p.percent / 100,
        at: p.updatedAt + STOP_AFTER_DAYS * DAY_MS,
      })
    }
  }
}

/** The best pick that is not already on the list, or undefined if there is none. */
async function nextBest(
  deps: ShortlistDeps,
  taken: Set<string>,
  now: Date,
): Promise<ShortlistPick | undefined> {
  // A replacement uses the newest weights, even though the rest of today's list stays fixed.
  const { profile, events } = await freshProfile(deps, now)
  const next = recommend({
    catalog: deps.catalog,
    profile,
    events,
    exclude: await todaysAvoid(deps, now),
    count: deps.catalog.length,
  }).picks.find((p) => !taken.has(p.entry.id))
  return next && { entry: next.entry, reason: next.reason }
}

/**
 * A pick the reader has finished since the list was made is swapped, in the same place, for the
 * next best pick. The other picks stay as they are.
 */
async function swapFinished(
  deps: ShortlistDeps,
  picks: ShortlistPick[],
  now: Date,
): Promise<ShortlistPick[]> {
  const { finished } = digestEvents(await deps.events.list())
  if (!picks.some((p) => finished.has(p.entry.id))) return picks
  let current = picks
  for (const done of picks.filter((p) => finished.has(p.entry.id))) {
    const replacement = await nextBest(
      deps,
      new Set(current.map((p) => p.entry.id)),
      now,
    )
    current = replacement
      ? current.map((p) => (p === done ? replacement : p))
      : current.filter((p) => p !== done)
  }
  await save(deps, current, now)
  return current
}

/**
 * Today's 6 picks. The first load of a local day asks the recommender and stores the answer;
 * every later load that day returns the stored picks.
 */
export async function loadShortlist(
  deps: ShortlistDeps,
  now: Date,
): Promise<ShortlistPick[]> {
  await sweepStops(deps, now)
  const settings = await deps.settings.get()
  const stored = settings.shortlist
  if (stored && stored.date === localDay(now) && stored.picks.length > 0) {
    const byId = new Map(deps.catalog.map((e) => [e.id, e]))
    const picks = stored.picks.flatMap((p) => {
      const entry = byId.get(p.workId)
      return entry ? [{ entry, reason: p.reason }] : []
    })
    if (picks.length === stored.picks.length) {
      return swapFinished(deps, picks, now)
    }
  }
  // A new day: learn from everything so far, keep the result, and pick from it.
  const { profile, events } = await freshProfile(deps, now)
  await deps.profile.put(profile)
  const picks = recommend({ catalog: deps.catalog, profile, events }).picks.map(
    (p) => ({ entry: p.entry, reason: p.reason }),
  )
  await save(deps, picks, now)
  return picks
}

/** Records one `shown` event for each pick not yet shown on this local day. */
export async function recordShown(
  deps: Pick<ShortlistDeps, 'events'>,
  picks: ShortlistPick[],
  now: Date,
): Promise<void> {
  const day = localDay(now)
  const seen = new Set(
    (await deps.events.list())
      .filter((e) => e.type === 'shown' && localDay(new Date(e.at)) === day)
      .map((e) => e.workId),
  )
  for (const { entry } of picks) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    await deps.events.append({
      workId: entry.id,
      type: 'shown',
      at: now.getTime(),
    })
  }
}

/** Opening the detail sheet counts as a tap. */
export async function recordTap(
  deps: Pick<ShortlistDeps, 'events'>,
  workId: string,
): Promise<void> {
  await deps.events.append({ workId, type: 'tap' })
}

/**
 * "Not for me": logs it, swaps in the next best pick in the same place, and stores the new list.
 * The returned list has no gap if the catalog has nothing left to offer.
 */
export async function removePick(
  deps: ShortlistDeps,
  current: ShortlistPick[],
  workId: string,
  now: Date,
): Promise<{ picks: ShortlistPick[]; replacement?: ShortlistPick }> {
  await deps.events.append({ workId, type: 'notForMe' })
  const replacement = await nextBest(
    deps,
    new Set(current.map((p) => p.entry.id)),
    now,
  )
  const picks = replacement
    ? current.map((p) => (p.entry.id === workId ? replacement : p))
    : current.filter((p) => p.entry.id !== workId)
  await save(deps, picks, now)
  return { picks, replacement }
}

/** Undo "Not for me": cancels it in the event log and puts the old list back. */
export async function undoRemove(
  deps: ShortlistDeps,
  previous: ShortlistPick[],
  workId: string,
  now: Date,
): Promise<void> {
  await deps.events.append({ workId, type: 'undo', reason: 'notForMe' })
  await save(deps, previous, now)
}
