import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import { digestEvents } from '../../engine/recommend'
import {
  type ShortlistDeps,
  loadShortlist,
  localDay,
  recordShown,
} from './dailyShortlist'
import { fakeCatalog, fakeStores } from './fakeStores'
import {
  loadLongList,
  removeLongListPick,
  undoRemoveLongList,
} from './longList'

const DAY = 24 * 60 * 60 * 1000
const TODAY = new Date(2026, 9, 16, 9, 0)
const TOMORROW = new Date(2026, 9, 17, 9, 0)

// story-0..2 are short stories the reader has read; story-3..9 are novelettes and novellas.
const catalog = fakeCatalog().map((e, i) => ({
  ...e,
  form: i < 3 ? 'story' : i % 2 === 0 ? 'novella' : 'novelette',
  lengthClass: i < 3 ? 'under10' : '60plus',
  readingMinutes: i < 3 ? 8 : 60,
})) as unknown as CatalogEntry[]

function setup() {
  const s = fakeStores()
  const deps: ShortlistDeps = {
    catalog,
    settings: s.settingsStore,
    profile: s.profileStore,
    events: s.eventLog,
    progress: s.progressStore,
  }
  return { s, deps }
}
const ids = (picks: { entry: CatalogEntry }[]) => picks.map((p) => p.entry.id)
async function rate(
  s: ReturnType<typeof fakeStores>,
  workIds: string[],
  at = TODAY.getTime() - 3 * DAY,
) {
  for (const id of workIds) {
    await s.eventLog.append({ workId: id, type: 'finished', at })
    await s.eventLog.append({ workId: id, type: 'love', at: at + 1 })
  }
}
const three = ['story-0', 'story-1', 'story-2']

describe('when it appears', () => {
  it('shows nothing, and stores nothing, before 3 positive finishes', async () => {
    const { s, deps } = setup()
    await rate(s, ['story-0', 'story-1'])
    expect(await loadLongList(deps, [], TODAY)).toEqual([])
    expect((await s.settingsStore.get()).longList).toBeUndefined()
  })

  it('shows up to 4 novelettes and novellas after 3', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const picks = await loadLongList(deps, [], TODAY)
    expect(picks).toHaveLength(4)
    for (const p of picks) {
      expect(['novelette', 'novella']).toContain(p.entry.form)
      expect(p.reason.length).toBeGreaterThan(5)
    }
  })

  it('never repeats a work from Your Shortlist', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const shortlist = ids(await loadShortlist(deps, TODAY))
    const picks = await loadLongList(deps, shortlist, TODAY)
    expect(picks.length).toBeGreaterThan(0)
    for (const id of ids(picks)) expect(shortlist).not.toContain(id)
  })
})

describe('the day’s list', () => {
  it('is saved with the date and is the same on every load that day', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    const saved = (await s.settingsStore.get()).longList!
    expect(saved.date).toBe(localDay(TODAY))
    expect(saved.picks.map((p) => p.workId)).toEqual(ids(first))
    // Something unrelated changes; the list does not.
    await s.eventLog.append({ workId: 'story-9', type: 'tap' })
    const again = await loadLongList(deps, [], new Date(2026, 9, 16, 20, 0))
    expect(again).toEqual(first)
  })

  it('is made again on a new day', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    await s.eventLog.append({ workId: first[0].entry.id, type: 'notForMe' })
    await s.eventLog.append({ workId: first[1].entry.id, type: 'notForMe' })
    const next = await loadLongList(deps, [], TOMORROW)
    expect(ids(next)).not.toEqual(ids(first))
    expect(ids(next)).not.toContain(first[0].entry.id)
    expect((await s.settingsStore.get()).longList?.date).toBe(
      localDay(TOMORROW),
    )
  })

  it('swaps a finished pick on the next visit and keeps the others', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    await s.eventLog.append({ workId: first[2].entry.id, type: 'finished' })
    const next = await loadLongList(deps, [], TODAY)
    expect(next).toHaveLength(4)
    expect(ids(next)).not.toContain(first[2].entry.id)
    for (const i of [0, 1, 3]) expect(next[i]).toEqual(first[i])
    expect(ids(await loadLongList(deps, [], TODAY))).toEqual(ids(next))
  })

  it('swaps a pick marked Not for me', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    await s.eventLog.append({ workId: first[0].entry.id, type: 'notForMe' })
    const next = await loadLongList(deps, [], TODAY)
    expect(ids(next)).not.toContain(first[0].entry.id)
    for (const i of [1, 2, 3]) expect(next[i]).toEqual(first[i])
  })

  it('swaps a pick that has since landed on Your Shortlist', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    const next = await loadLongList(deps, [first[1].entry.id], TODAY)
    expect(ids(next)).not.toContain(first[1].entry.id)
    expect(next).toHaveLength(4)
  })
})

describe('Not for me and Undo on a Long List card', () => {
  it('swaps the card in place, then Undo puts the list back', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    const gone = first[1].entry.id
    const result = await removeLongListPick(deps, first, gone, [], TODAY)
    expect(result.picks).toHaveLength(4)
    expect(ids(result.picks)).not.toContain(gone)
    expect(result.picks[1].entry.id).toBe(result.replacement!.entry.id)
    expect(
      s.events.some((e) => e.type === 'notForMe' && e.workId === gone),
    ).toBe(true)

    await undoRemoveLongList(deps, first, gone, TODAY)
    expect(digestEvents(await s.eventLog.list()).notForMe.has(gone)).toBe(false)
    expect(ids(await loadLongList(deps, [], TODAY))).toEqual(ids(first))
  })
})

describe('shown, and rotating out after 7 days', () => {
  it('records shown once per work per day', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const picks = await loadLongList(deps, [], TODAY)
    await recordShown(deps, picks, TODAY)
    await recordShown(deps, picks, new Date(2026, 9, 16, 22, 0))
    expect(s.events.filter((e) => e.type === 'shown')).toHaveLength(4)
  })

  it('rotates a pick out after it was shown on 7 different days without a tap', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    const stale = first[0].entry.id
    for (let d = 1; d <= 7; d++) {
      await s.eventLog.append({
        workId: stale,
        type: 'shown',
        at: TODAY.getTime() - d * DAY,
      })
    }
    const next = await loadLongList(deps, [], TOMORROW)
    expect(ids(next)).not.toContain(stale)
    expect(next).toHaveLength(4)
  })

  it('keeps a pick that was tapped along the way', async () => {
    const { s, deps } = setup()
    await rate(s, three)
    const first = await loadLongList(deps, [], TODAY)
    const kept = first[0].entry.id
    for (let d = 1; d <= 7; d++) {
      await s.eventLog.append({
        workId: kept,
        type: 'shown',
        at: TODAY.getTime() - d * DAY,
      })
    }
    await s.eventLog.append({
      workId: kept,
      type: 'tap',
      at: TODAY.getTime() - 3.5 * DAY,
    })
    expect(ids(await loadLongList(deps, [], TOMORROW))).toContain(kept)
  })
})
