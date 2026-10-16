import type { CatalogEntry } from '../../catalog'
import { recommend } from '../../engine/recommend'
import type {
  EventLog,
  LibraryStore,
  ProfileStore,
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

async function save(
  deps: ShortlistDeps,
  picks: ShortlistPick[],
  now: Date,
): Promise<void> {
  await deps.settings.update({
    shortlist: {
      date: localDay(now),
      picks: picks.map((p) => ({ workId: p.entry.id, reason: p.reason })),
    },
  })
}

/**
 * Today's 6 picks. The first load of a local day asks the recommender and stores the answer;
 * every later load that day returns the stored picks.
 */
export async function loadShortlist(
  deps: ShortlistDeps,
  now: Date,
): Promise<ShortlistPick[]> {
  const settings = await deps.settings.get()
  const stored = settings.shortlist
  if (stored && stored.date === localDay(now) && stored.picks.length > 0) {
    const byId = new Map(deps.catalog.map((e) => [e.id, e]))
    const picks = stored.picks.flatMap((p) => {
      const entry = byId.get(p.workId)
      return entry ? [{ entry, reason: p.reason }] : []
    })
    if (picks.length === stored.picks.length) return picks
  }
  const [profile, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
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

/** Dog-ear: log it and keep the work in the library. */
export async function dogEar(
  deps: Pick<ShortlistDeps, 'events'> & { library: LibraryStore },
  workId: string,
): Promise<void> {
  await deps.events.append({ workId, type: 'save' })
  await deps.library.save(workId)
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
  const [profile, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  const taken = new Set(current.map((p) => p.entry.id))
  const next = recommend({
    catalog: deps.catalog,
    profile,
    events,
    count: deps.catalog.length,
  }).picks.find((p) => !taken.has(p.entry.id))
  const replacement = next && { entry: next.entry, reason: next.reason }
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
