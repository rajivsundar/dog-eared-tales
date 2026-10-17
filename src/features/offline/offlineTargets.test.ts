import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { Progress, ReaderEvent, SavedWork } from '../../stores'
import { fakeCatalog } from '../shortlist/fakeStores'
import { offlineTargets } from './offlineTargets'

const catalog = fakeCatalog().map((e, i) => ({
  ...e,
  textUrl: `/texts/pg-${i}.epub`,
})) as unknown as CatalogEntry[]
// story-8 and story-9 sit in one book, so they share a file.
catalog[9] = { ...catalog[9], textUrl: catalog[8].textUrl }

const TODAY = '2026-10-16'
const list = (date: string, ...ids: string[]) => ({
  date,
  picks: ids.map((workId) => ({ workId, reason: 'r' })),
})
const saved = (workId: string): SavedWork => ({
  workId,
  shelf: 'default',
  addedAt: 1,
  offline: false,
})
const progress = (workId: string, percent: number): Progress => ({
  workId,
  locator: 'x',
  percent,
  secondsRead: 5,
  updatedAt: 10,
})
const finished = (workId: string): ReaderEvent => ({
  id: `f-${workId}`,
  workId,
  type: 'finished',
  at: 20,
})
const base = { catalog, library: [], progress: [], events: [], today: TODAY }

describe('which books to keep for offline', () => {
  it("includes every pick on both of today's lists", () => {
    const urls = offlineTargets({
      ...base,
      shortlist: list(TODAY, 'story-0', 'story-1'),
      longList: list(TODAY, 'story-2'),
    })
    expect(urls).toEqual([
      '/texts/pg-0.epub',
      '/texts/pg-1.epub',
      '/texts/pg-2.epub',
    ])
  })

  it('includes Dog-eared works and works under Reading', () => {
    const urls = offlineTargets({
      ...base,
      library: [saved('story-3')],
      progress: [progress('story-4', 40)],
    })
    expect(urls).toEqual(['/texts/pg-4.epub', '/texts/pg-3.epub'])
  })

  it('leaves out finished works', () => {
    const urls = offlineTargets({
      ...base,
      library: [saved('story-3')],
      progress: [progress('story-3', 100), progress('story-4', 100)],
      events: [finished('story-3'), finished('story-4')],
    })
    expect(urls).toEqual([])
  })

  it('ignores a list made on another day', () => {
    expect(
      offlineTargets({ ...base, shortlist: list('2026-10-15', 'story-0') }),
    ).toEqual([])
  })

  it('names each file once, even when works and lists share it', () => {
    const urls = offlineTargets({
      ...base,
      shortlist: list(TODAY, 'story-8', 'story-9'),
      library: [saved('story-8')],
      progress: [progress('story-8', 30)],
    })
    expect(urls).toEqual(['/texts/pg-8.epub'])
  })

  it('skips works that are not in the catalog', () => {
    expect(offlineTargets({ ...base, shortlist: list(TODAY, 'nope') })).toEqual(
      [],
    )
  })
})

describe('the seasonal row', () => {
  it("includes today's Tales for Longer Nights, and ignores another day's", () => {
    expect(
      offlineTargets({ ...base, talesRow: list(TODAY, 'story-5') }),
    ).toEqual(['/texts/pg-5.epub'])
    expect(
      offlineTargets({ ...base, talesRow: list('2020-01-01', 'story-5') }),
    ).toEqual([])
  })
})
