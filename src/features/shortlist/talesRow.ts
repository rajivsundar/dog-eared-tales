import { buildProfile, rankLongNights } from '../../engine/recommend'
import type { Season } from '../../app/seasons'
import {
  type ShortlistDeps,
  type ShortlistPick,
  localDay,
} from './dailyShortlist'

/** Tales for Longer Nights: today's seasonal row, up to 6 eerie tales ranked for this reader. */

const SIZE = 6

async function save(
  deps: ShortlistDeps,
  picks: ShortlistPick[],
  now: Date,
): Promise<void> {
  await deps.settings.update({
    talesRow: {
      date: localDay(now),
      picks: picks.map((p) => ({ workId: p.entry.id, reason: p.reason })),
    },
  })
}

async function ranked(
  deps: ShortlistDeps,
  season: Pick<Season, 'talesRow'>,
  now: Date,
  extraAvoid: string[] = [],
): Promise<ShortlistPick[]> {
  const [stored, events] = await Promise.all([
    deps.profile.get(),
    deps.events.list(),
  ])
  const profile = buildProfile(deps.catalog, events, now.getTime(), stored)
  return rankLongNights({
    catalog: deps.catalog,
    profile,
    events,
    avoid: extraAvoid,
    featuredId: season.talesRow.featuredStoryId,
    featuredReason: season.talesRow.featuredReason,
  })
}

/**
 * The seasonal row for today. Finished works, works marked Not for me and works already on today's
 * Your Shortlist never appear. The list is
 * kept in the settings so its books can be stored for offline reading.
 */
export async function loadTalesRow(
  deps: ShortlistDeps,
  season: Pick<Season, 'talesRow'>,
  now: Date,
  shortlistIds: string[] = [],
): Promise<ShortlistPick[]> {
  const picks = (await ranked(deps, season, now, shortlistIds)).slice(0, SIZE)
  await save(deps, picks, now)
  return picks
}

/** Not for me on a card in the row: log it and fill the place with the next best tale. */
export async function removeTale(
  deps: ShortlistDeps,
  season: Pick<Season, 'talesRow'>,
  current: ShortlistPick[],
  workId: string,
  now: Date,
  shortlistIds: string[] = [],
): Promise<ShortlistPick[]> {
  await deps.events.append({ workId, type: 'notForMe' })
  const picks = (await ranked(deps, season, now, shortlistIds)).slice(0, SIZE)
  await save(deps, picks, now)
  void current
  return picks
}

/** Undo Not for me on a card in the row. */
export async function undoRemoveTale(
  deps: ShortlistDeps,
  previous: ShortlistPick[],
  workId: string,
  now: Date,
): Promise<void> {
  await deps.events.append({ workId, type: 'undo', reason: 'notForMe' })
  await save(deps, previous, now)
}
