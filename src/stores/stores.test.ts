import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TwiceToldDB } from './db'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { DEFAULT_SETTINGS, createSettingsStore } from './settingsStore'
import { newTestDb } from './testDb'
import { FONTS, THEMES } from './types'

let db: TwiceToldDB

beforeEach(() => {
  db = newTestDb()
})

afterEach(async () => {
  await db.delete()
})

describe('database', () => {
  it('starts at schema version 1', async () => {
    await db.open()
    expect(db.verno).toBe(1)
  })
})

describe('ProfileStore', () => {
  it('is empty at first, then saves and clears a profile', async () => {
    const store = createProfileStore(db)
    expect(await store.get()).toBeUndefined()
    await store.put({
      id: 'ignored',
      tasteVector: [0.6, 0.8],
      facetBeliefs: { 'genre:horror': { success: 2, failure: 1 } },
      ladderLevel: 1,
      wordsPerMinute: 220,
      version: 1,
    })
    const saved = await store.get()
    expect(saved?.tasteVector).toEqual([0.6, 0.8])
    expect(saved?.facetBeliefs['genre:horror'].success).toBe(2)
    await store.clear()
    expect(await store.get()).toBeUndefined()
  })
})

describe('EventLog', () => {
  it('appends events with an id and a timestamp', async () => {
    const log = createEventLog(db)
    const event = await log.append({ workId: 'w1', type: 'love', value: 1 })
    expect(event.id).toBeTruthy()
    expect(event.at).toBeGreaterThan(0)
  })

  it('lists events oldest first, for all works or one work', async () => {
    const log = createEventLog(db)
    await log.append({ workId: 'w1', type: 'ok', at: 300 })
    await log.append({ workId: 'w2', type: 'love', at: 100 })
    await log.append({ workId: 'w1', type: 'finished', at: 200 })
    expect((await log.list()).map((e) => e.at)).toEqual([100, 200, 300])
    expect((await log.listForWork('w1')).map((e) => e.type)).toEqual([
      'finished',
      'ok',
    ])
  })

  it('has no way to edit or delete events', () => {
    expect(Object.keys(createEventLog(db)).sort()).toEqual([
      'append',
      'list',
      'listForWork',
    ])
  })
})

describe('LibraryStore', () => {
  it('saves, lists newest first, and removes', async () => {
    const lib = createLibraryStore(db)
    await lib.save('w1')
    await new Promise((r) => setTimeout(r, 5))
    await lib.save('w2', { offline: true })
    expect((await lib.list()).map((i) => i.workId)).toEqual(['w2', 'w1'])
    expect((await lib.get('w2'))?.offline).toBe(true)
    await lib.remove('w1')
    expect(await lib.get('w1')).toBeUndefined()
  })

  it('saving again keeps the original date added', async () => {
    const lib = createLibraryStore(db)
    const first = await lib.save('w1')
    const again = await lib.save('w1', { shelf: 'Weekend' })
    expect(again.addedAt).toBe(first.addedAt)
    expect(again.shelf).toBe('Weekend')
  })
})

describe('ProgressStore', () => {
  it('keeps one position per work and updates it', async () => {
    const store = createProgressStore(db)
    await store.set({
      workId: 'w1',
      locator: 'a',
      percent: 10,
      secondsRead: 60,
    })
    const updated = await store.set({
      workId: 'w1',
      locator: 'b',
      percent: 40,
      secondsRead: 300,
    })
    expect(updated.updatedAt).toBeGreaterThan(0)
    expect((await store.get('w1'))?.locator).toBe('b')
    expect(await store.list()).toHaveLength(1)
    await store.remove('w1')
    expect(await store.get('w1')).toBeUndefined()
  })
})

describe('HighlightStore', () => {
  it('adds, lists by work, and removes', async () => {
    const store = createHighlightStore(db)
    const h = await store.add({
      workId: 'w1',
      locator: 'x',
      color: 'yellow',
      note: 'nice',
    })
    await store.add({ workId: 'w2', locator: 'y', color: 'pink' })
    expect(h.id).toBeTruthy()
    expect(await store.listForWork('w1')).toHaveLength(1)
    await store.remove(h.id)
    expect(await store.listForWork('w1')).toHaveLength(0)
  })
})

describe('SettingsStore', () => {
  it('returns the defaults: literata, text size 5, system theme', async () => {
    const settings = await createSettingsStore(db).get()
    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(settings.font).toBe('literata')
    expect(settings.textSize).toBe(5)
    expect(settings.theme).toBe('system')
  })

  it('offers the SRS fonts and themes', () => {
    expect(FONTS).toEqual([
      'literata',
      'atkinson',
      'opendyslexic',
      'systemSerif',
    ])
    expect(THEMES).toEqual(['system', 'paper', 'sepia', 'night', 'black'])
  })

  it('keeps changes and leaves other settings alone', async () => {
    const store = createSettingsStore(db)
    await store.update({ theme: 'night', textSize: 8, font: 'atkinson' })
    const saved = await store.get()
    expect(saved.theme).toBe('night')
    expect(saved.textSize).toBe(8)
    expect(saved.font).toBe('atkinson')
    expect(saved.mix).toBe(DEFAULT_SETTINGS.mix)
  })

  it('rejects a text size outside 1 to 10', async () => {
    const store = createSettingsStore(db)
    await expect(store.update({ textSize: 0 })).rejects.toThrow(RangeError)
    await expect(store.update({ textSize: 11 })).rejects.toThrow(RangeError)
    await expect(store.update({ textSize: 4.5 })).rejects.toThrow(RangeError)
    expect((await store.get()).textSize).toBe(5)
    await store.update({ textSize: 1 })
    await store.update({ textSize: 10 })
    expect((await store.get()).textSize).toBe(10)
  })
})
