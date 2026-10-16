import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import { digestEvents } from '../../engine/recommend/history'
import {
  type ShortlistDeps,
  loadShortlist,
  localDay,
  recordShown,
  removePick,
  shortlistTitle,
  undoRemove,
} from './dailyShortlist'
import { fakeCatalog, fakeStores } from './fakeStores'

const catalog = fakeCatalog() as unknown as CatalogEntry[]
const MORNING = new Date(2026, 9, 16, 9, 0)
const LATER = new Date(2026, 9, 16, 15, 0)
const NEXT_DAY = new Date(2026, 9, 17, 9, 0)

function setup() {
  const s = fakeStores()
  const deps: ShortlistDeps = {
    catalog,
    settings: s.settingsStore,
    profile: s.profileStore,
    events: s.eventLog,
  }
  return { s, deps }
}
const ids = (picks: { entry: CatalogEntry }[]) => picks.map((p) => p.entry.id)

describe('title', () => {
  it("is Tonight's Shortlist from 6 pm to 4 am, otherwise Your Shortlist", () => {
    const at = (h: number, m = 0) => shortlistTitle(new Date(2026, 9, 16, h, m))
    expect(at(17, 59)).toBe('Your Shortlist')
    expect(at(18)).toBe("Tonight's Shortlist")
    expect(at(23, 30)).toBe("Tonight's Shortlist")
    expect(at(0)).toBe("Tonight's Shortlist")
    expect(at(3, 59)).toBe("Tonight's Shortlist")
    expect(at(4)).toBe('Your Shortlist')
    expect(at(12)).toBe('Your Shortlist')
  })
  it('names the local day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('daily picks', () => {
  it('stores 6 picks with their reasons and the date', async () => {
    const { s, deps } = setup()
    const picks = await loadShortlist(deps, MORNING)
    expect(picks).toHaveLength(6)
    const saved = (await s.settingsStore.get()).shortlist
    expect(saved?.date).toBe('2026-10-16')
    expect(saved?.picks.map((p) => p.workId)).toEqual(ids(picks))
  })

  it('gives the same picks on every load that day, even after things change', async () => {
    const { s, deps } = setup()
    const first = await loadShortlist(deps, MORNING)
    await s.eventLog.append({ workId: first[0].entry.id, type: 'love' })
    const unlisted = catalog.find((e) => !ids(first).includes(e.id))!
    await s.eventLog.append({ workId: unlisted.id, type: 'finished' })
    const again = await loadShortlist(deps, LATER)
    expect(again).toEqual(first)
  })

  it('makes new picks on a new local day', async () => {
    const { s, deps } = setup()
    const first = await loadShortlist(deps, MORNING)
    await s.eventLog.append({ workId: first[0].entry.id, type: 'finished' })
    await s.eventLog.append({ workId: first[1].entry.id, type: 'notForMe' })
    const next = await loadShortlist(deps, NEXT_DAY)
    expect(ids(next)).not.toEqual(ids(first))
    expect(ids(next)).not.toContain(first[0].entry.id)
    expect((await s.settingsStore.get()).shortlist?.date).toBe('2026-10-17')
  })
})

describe('shown events', () => {
  it('records one per entry per local day, however often the page loads', async () => {
    const { s, deps } = setup()
    const picks = await loadShortlist(deps, MORNING)
    await recordShown(deps, picks, MORNING)
    await recordShown(deps, picks, LATER)
    await recordShown(deps, picks, LATER)
    const shown = s.events.filter((e) => e.type === 'shown')
    expect(shown).toHaveLength(6)
    expect(new Set(shown.map((e) => e.workId)).size).toBe(6)
  })

  it('records again on the next day', async () => {
    const { s, deps } = setup()
    const picks = await loadShortlist(deps, MORNING)
    await recordShown(deps, picks, MORNING)
    await recordShown(deps, picks, NEXT_DAY)
    expect(s.events.filter((e) => e.type === 'shown')).toHaveLength(12)
  })
})

describe('finished works', () => {
  it('swaps a finished pick for the next best one and keeps the other 5', async () => {
    const { s, deps } = setup()
    const first = await loadShortlist(deps, MORNING)
    await s.eventLog.append({ workId: first[2].entry.id, type: 'finished' })

    const next = await loadShortlist(deps, LATER)
    expect(next).toHaveLength(6)
    expect(ids(next)).not.toContain(first[2].entry.id)
    for (const i of [0, 1, 3, 4, 5]) expect(next[i]).toEqual(first[i])
    expect(ids(first)).not.toContain(next[2].entry.id)
    // It is stored, so the next visit shows the same list.
    expect(ids(await loadShortlist(deps, LATER))).toEqual(ids(next))
  })

  it('swaps several finished picks at once, each in its own place', async () => {
    const { s, deps } = setup()
    const first = await loadShortlist(deps, MORNING)
    await s.eventLog.append({ workId: first[0].entry.id, type: 'finished' })
    await s.eventLog.append({ workId: first[5].entry.id, type: 'finished' })
    const next = await loadShortlist(deps, LATER)
    expect(next).toHaveLength(6)
    expect(new Set(ids(next)).size).toBe(6)
    for (const i of [1, 2, 3, 4]) expect(next[i]).toEqual(first[i])
  })
})

describe('not for me and undo', () => {
  it('swaps in a new pick in the same place and stores the list', async () => {
    const { s, deps } = setup()
    const picks = await loadShortlist(deps, MORNING)
    const gone = picks[2].entry.id
    const result = await removePick(deps, picks, gone, LATER)
    expect(result.picks).toHaveLength(6)
    expect(ids(result.picks)).not.toContain(gone)
    expect(result.picks[2].entry.id).toBe(result.replacement?.entry.id)
    expect(ids(picks)).not.toContain(result.replacement!.entry.id)
    expect(
      s.events.some((e) => e.type === 'notForMe' && e.workId === gone),
    ).toBe(true)
    const reloaded = await loadShortlist(deps, LATER)
    expect(ids(reloaded)).toEqual(ids(result.picks))
  })

  it('undo restores the old list and cancels the not-for-me', async () => {
    const { s, deps } = setup()
    const picks = await loadShortlist(deps, MORNING)
    const gone = picks[2].entry.id
    await removePick(deps, picks, gone, LATER)
    expect(digestEvents(await s.eventLog.list()).notForMe.has(gone)).toBe(true)

    await undoRemove(deps, picks, gone, LATER)

    expect(s.events.some((e) => e.type === 'undo' && e.workId === gone)).toBe(
      true,
    )
    expect(digestEvents(await s.eventLog.list()).notForMe.has(gone)).toBe(false)
    expect(ids(await loadShortlist(deps, LATER))).toEqual(ids(picks))
  })
})
