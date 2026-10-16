import {
  buildProfile,
  digestEvents,
  isLongListUnlocked,
  longListSize,
  rankLongList,
} from '../../engine/recommend'
import type { ReaderEvent } from '../../stores'
import {
  type ShortlistDeps,
  type ShortlistPick,
  localDay,
} from './dailyShortlist'

/** Your Long List: up to 4 novelettes and novellas, kept for the day like Your Shortlist. */

async function save(
  deps: ShortlistDeps,
  picks: ShortlistPick[],
  now: Date,
): Promise<void> {
  await deps.settings.update({
    longList: {
      date: localDay(now),
      picks: picks.map((p) => ({ workId: p.entry.id, reason: p.reason })),
    },
  })
}

async function context(deps: ShortlistDeps, now: Date) {
  const [stored, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  const profile = buildProfile(deps.catalog, events, now.getTime(), stored)
  return { profile, events }
}

/** The next best pick that is not already on the list (or on the shortlist). */
function nextBest(
  deps: ShortlistDeps,
  profile: Awaited<ReturnType<typeof context>>['profile'],
  events: ReaderEvent[],
  taken: Iterable<string>,
): ShortlistPick | undefined {
  const next = rankLongList({
    catalog: deps.catalog,
    profile,
    events,
    avoid: [...taken],
  })[0]
  return next && { entry: next.entry, reason: next.reason }
}

/**
 * Today's Long List. Empty until the reader has finished 3 works rated Loved it or It was OK.
 * The first visit of a day picks and stores the list; later visits return it, swapping out any
 * pick that has since been finished, marked Not for me, or taken onto the shortlist.
 */
export async function loadLongList(
  deps: ShortlistDeps,
  shortlistIds: string[],
  now: Date,
): Promise<ShortlistPick[]> {
  const { profile, events } = await context(deps, now)
  if (!isLongListUnlocked(events)) return []

  const stored = (await deps.settings.get()).longList
  const byId = new Map(deps.catalog.map((e) => [e.id, e]))
  if (stored && stored.date === localDay(now) && stored.picks.length > 0) {
    const picks = stored.picks.flatMap((p) => {
      const entry = byId.get(p.workId)
      return entry ? [{ entry, reason: p.reason }] : []
    })
    if (picks.length === stored.picks.length) {
      const { finished, notForMe } = digestEvents(events)
      const onShortlist = new Set(shortlistIds)
      const bad = (p: ShortlistPick): boolean =>
        finished.has(p.entry.id) ||
        notForMe.has(p.entry.id) ||
        onShortlist.has(p.entry.id)
      if (!picks.some(bad)) return picks
      let current = picks
      for (const gone of picks.filter(bad)) {
        const replacement = nextBest(deps, profile, events, [
          ...current.map((p) => p.entry.id),
          ...shortlistIds,
        ])
        current = replacement
          ? current.map((p) => (p === gone ? replacement : p))
          : current.filter((p) => p !== gone)
      }
      await save(deps, current, now)
      return current
    }
  }

  const picks = rankLongList({
    catalog: deps.catalog,
    profile,
    events,
    avoid: shortlistIds,
  })
    .slice(0, longListSize(profile.facetBeliefs))
    .map((p) => ({ entry: p.entry, reason: p.reason }))
  await save(deps, picks, now)
  return picks
}

/** Not for me on a Long List pick: log it and swap in the next best one in the same place. */
export async function removeLongListPick(
  deps: ShortlistDeps,
  current: ShortlistPick[],
  workId: string,
  shortlistIds: string[],
  now: Date,
): Promise<{ picks: ShortlistPick[]; replacement?: ShortlistPick }> {
  await deps.events.append({ workId, type: 'notForMe' })
  const { profile, events } = await context(deps, now)
  const replacement = nextBest(deps, profile, events, [
    ...current.map((p) => p.entry.id),
    ...shortlistIds,
  ])
  const picks = replacement
    ? current.map((p) => (p.entry.id === workId ? replacement : p))
    : current.filter((p) => p.entry.id !== workId)
  await save(deps, picks, now)
  return { picks, replacement }
}

/** Undo Not for me on a Long List pick. */
export async function undoRemoveLongList(
  deps: ShortlistDeps,
  previous: ShortlistPick[],
  workId: string,
  now: Date,
): Promise<void> {
  await deps.events.append({ workId, type: 'undo', reason: 'notForMe' })
  await save(deps, previous, now)
}
