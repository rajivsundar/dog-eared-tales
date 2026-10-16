import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { Progress, ReaderEvent, SavedWork } from '../../stores'
import { fakeCatalog } from '../shortlist/fakeStores'
import { minutesLeftFor, sortLibrary } from './libraryLists'

const catalog = fakeCatalog().map((e) => ({
  ...e,
  wordCount: 2380, // 10 minutes
})) as unknown as CatalogEntry[]

const progress = (
  workId: string,
  percent: number,
  updatedAt: number,
): Progress => ({
  workId,
  locator: 'x',
  percent,
  secondsRead: 0,
  updatedAt,
})
const saved = (workId: string, addedAt: number): SavedWork => ({
  workId,
  shelf: 'default',
  addedAt,
  offline: false,
})
const finished = (workId: string, at: number): ReaderEvent => ({
  id: `f${at}`,
  workId,
  type: 'finished',
  at,
})

const run = (input: {
  progress?: Progress[]
  library?: SavedWork[]
  events?: ReaderEvent[]
}) => sortLibrary({ catalog, progress: [], library: [], events: [], ...input })
const ids = (items: { entry: CatalogEntry }[]) => items.map((i) => i.entry.id)

describe('Reading', () => {
  it('lists works with a turned page, most recent first, with minutes left', () => {
    const lists = run({
      progress: [progress('story-1', 50, 100), progress('story-2', 20, 200)],
    })
    expect(ids(lists.reading)).toEqual(['story-2', 'story-1'])
    expect(lists.reading.map((r) => r.minutesLeft)).toEqual([8, 5])
  })

  it('never shows 0 minutes left', () => {
    expect(minutesLeftFor(catalog[0], 99.99)).toBe(1)
  })
})

describe('Dog-eared', () => {
  it('lists dog-eared works that are not started, newest first', () => {
    const lists = run({
      library: [saved('story-1', 100), saved('story-2', 300)],
    })
    expect(ids(lists.dogEared)).toEqual(['story-2', 'story-1'])
    expect(lists.reading).toEqual([])
  })

  it('keeps a work here when it was opened but no page was turned', () => {
    const open: ReaderEvent = {
      id: 'o',
      workId: 'story-1',
      type: 'open',
      at: 500,
    }
    const lists = run({ library: [saved('story-1', 100)], events: [open] })
    expect(ids(lists.dogEared)).toEqual(['story-1'])
    expect(lists.reading).toEqual([])
  })

  it('keeps a work here while its saved position is still the start (0%)', () => {
    const lists = run({
      library: [saved('story-1', 100)],
      progress: [progress('story-1', 0, 600)],
    })
    expect(ids(lists.dogEared)).toEqual(['story-1'])
    expect(lists.reading).toEqual([])
  })

  it('moves a work to Reading once a page is turned', () => {
    const lists = run({
      library: [saved('story-1', 100)],
      progress: [progress('story-1', 4.5, 600)],
    })
    expect(ids(lists.reading)).toEqual(['story-1'])
    expect(lists.dogEared).toEqual([])
  })
})

describe('Finished', () => {
  it('lists finished works, newest first, with the finish time', () => {
    const lists = run({
      progress: [progress('story-1', 100, 100), progress('story-2', 100, 300)],
      events: [finished('story-1', 150), finished('story-2', 350)],
    })
    expect(ids(lists.finished)).toEqual(['story-2', 'story-1'])
    expect(lists.finished[0].at).toBe(350)
  })

  it('moves a dog-eared work out of Dog-eared once it is finished', () => {
    const lists = run({
      library: [saved('story-1', 100)],
      progress: [progress('story-1', 100, 400)],
      events: [finished('story-1', 410)],
    })
    expect(ids(lists.finished)).toEqual(['story-1'])
    expect(lists.dogEared).toEqual([])
  })

  it('moves a finished work back to Reading when it is started again', () => {
    const lists = run({
      progress: [progress('story-1', 30, 900)],
      events: [finished('story-1', 410)],
    })
    expect(ids(lists.reading)).toEqual(['story-1'])
    expect(lists.finished).toEqual([])
  })
})

describe('one tab per work', () => {
  it('puts every work in exactly one tab, and leaves out works that are in none', () => {
    const lists = run({
      library: [
        saved('story-0', 10),
        saved('story-1', 20),
        saved('story-2', 30),
      ],
      progress: [
        progress('story-1', 40, 500),
        progress('story-2', 100, 500),
        progress('story-3', 10, 600),
      ],
      events: [finished('story-2', 510), finished('story-4', 520)],
    })
    const all = [
      ...ids(lists.reading),
      ...ids(lists.dogEared),
      ...ids(lists.finished),
    ]
    expect(all.sort()).toEqual([
      'story-0',
      'story-1',
      'story-2',
      'story-3',
      'story-4',
    ])
    expect(new Set(all).size).toBe(all.length)
    expect(run({}).reading).toEqual([])
  })

  it('ignores works that are not in the catalog', () => {
    const lists = run({
      library: [saved('gone', 1)],
      progress: [progress('gone', 50, 1)],
    })
    expect(lists).toEqual({ reading: [], dogEared: [], finished: [] })
  })
})
