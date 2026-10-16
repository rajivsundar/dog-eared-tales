import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_SCHEMA_VERSION,
  BackupError,
  createDataStore,
  parseBackup,
} from './backup'
import type { TwiceToldDB } from './db'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'
import { newTestDb } from './testDb'

let db: TwiceToldDB

beforeEach(() => {
  db = newTestDb()
})
afterEach(async () => {
  await db.delete()
})

/** Puts something in every store. */
async function fill(target: TwiceToldDB) {
  await createProfileStore(target).put({
    id: 'profile',
    tasteVector: [],
    facetBeliefs: { 'mood:eerie': { success: 3, failure: 0 } },
    ladderLevel: 2,
    wordsPerMinute: 238,
    version: 2,
  })
  const log = createEventLog(target)
  await log.append({ workId: 'w1', type: 'finished', at: 100 })
  await log.append({ workId: 'w1', type: 'love', at: 200 })
  await log.append({
    workId: 'w2',
    type: 'notForMe',
    reason: 'too-long',
    at: 300,
  })
  await createLibraryStore(target).save('w3', { shelf: 'Weekend', addedAt: 50 })
  await createProgressStore(target).set({
    workId: 'w2',
    locator: 'epubcfi(/6/4)',
    percent: 40,
    secondsRead: 600,
  })
  await createHighlightStore(target).add({
    workId: 'w1',
    locator: 'epubcfi(/6/2)',
    color: 'yellow',
    note: 'nice',
  })
  await createSettingsStore(target).update({
    theme: 'night',
    textSize: 7,
    shortlist: { date: '2026-10-16', picks: [{ workId: 'w1', reason: 'r' }] },
    persistence: { requested: true, granted: true },
  })
}

const everything = (target: TwiceToldDB) => createDataStore(target).exportAll()
const withoutDate = (backup: Awaited<ReturnType<typeof everything>>) => ({
  ...backup,
  exportedAt: 'x',
})

describe('exporting', () => {
  it('writes every store, with the app name, a schema version and a date', async () => {
    await fill(db)
    const backup = await everything(db)
    expect(backup.app).toBe('twice-told')
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(new Date(backup.exportedAt).toString()).not.toBe('Invalid Date')
    expect(Object.keys(backup.stores).sort()).toEqual([
      'events',
      'highlights',
      'library',
      'profile',
      'progress',
      'settings',
    ])
    expect(backup.stores.events).toHaveLength(3)
    expect(backup.stores.library).toHaveLength(1)
    expect(backup.stores.highlights[0].note).toBe('nice')
    expect(backup.stores.settings[0].theme).toBe('night')
  })

  it('is plain JSON that survives being written to a file and read back', async () => {
    await fill(db)
    const backup = await everything(db)
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup)
  })
})

describe('export, delete everything, import', () => {
  it('gives back identical data', async () => {
    await fill(db)
    const data = createDataStore(db)
    const before = await data.exportAll()
    const file = JSON.stringify(before) // the downloaded file

    await data.deleteAll()
    const empty = await data.exportAll()
    for (const records of Object.values(empty.stores))
      expect(records).toEqual([])

    await data.importAll(parseBackup(file))
    const after = await data.exportAll()
    expect(withoutDate(after)).toEqual(withoutDate(before))
    // The stores work as normal afterwards.
    expect((await createLibraryStore(db).get('w3'))?.shelf).toBe('Weekend')
    expect((await createEventLog(db).list()).map((e) => e.type)).toEqual([
      'finished',
      'love',
      'notForMe',
    ])
  })

  it('imports into a different, empty device too', async () => {
    await fill(db)
    const backup = await createDataStore(db).exportAll()
    const other = newTestDb()
    await createDataStore(other).importAll(backup)
    expect(withoutDate(await createDataStore(other).exportAll())).toEqual(
      withoutDate(backup),
    )
    await other.delete()
  })

  it('replaces what is there, rather than merging', async () => {
    await fill(db)
    const backup = await createDataStore(db).exportAll()
    await createEventLog(db).append({ workId: 'extra', type: 'open', at: 999 })
    await createLibraryStore(db).save('extra')
    await createDataStore(db).importAll(backup)
    const after = await createDataStore(db).exportAll()
    expect(after.stores.events.map((e) => e.workId)).not.toContain('extra')
    expect(after.stores.library.map((l) => l.workId)).toEqual(['w3'])
  })
})

describe('refusing bad files', () => {
  const valid = async () =>
    JSON.stringify(
      await (async () => {
        await fill(db)
        return createDataStore(db).exportAll()
      })(),
    )

  it('refuses a backup from a newer schema version', async () => {
    const newer = JSON.parse(await valid())
    newer.schemaVersion = BACKUP_SCHEMA_VERSION + 1
    expect(() => parseBackup(JSON.stringify(newer))).toThrow(BackupError)
    try {
      parseBackup(JSON.stringify(newer))
    } catch (error) {
      expect((error as BackupError).problem).toBe('newer-version')
      expect((error as BackupError).message).toMatch(/newer version/)
    }
  })

  it('refuses a newer backup even when it is handed straight to importAll, and changes nothing', async () => {
    await fill(db)
    const data = createDataStore(db)
    const before = await data.exportAll()
    const newer = { ...before, schemaVersion: BACKUP_SCHEMA_VERSION + 5 }
    await expect(data.importAll(newer)).rejects.toThrow(BackupError)
    expect(withoutDate(await data.exportAll())).toEqual(withoutDate(before))
  })

  it('accepts the current version and older ones', async () => {
    const file = JSON.parse(await valid())
    file.schemaVersion = BACKUP_SCHEMA_VERSION
    expect(parseBackup(JSON.stringify(file)).schemaVersion).toBe(
      BACKUP_SCHEMA_VERSION,
    )
    file.schemaVersion = 0
    expect(parseBackup(JSON.stringify(file)).schemaVersion).toBe(0)
  })

  it('refuses text that is not JSON, or JSON that is not a backup, or an incomplete one', async () => {
    const problem = (text: string) => {
      try {
        parseBackup(text)
      } catch (error) {
        return (error as BackupError).problem
      }
      return 'accepted'
    }
    expect(problem('hello')).toBe('not-json')
    expect(problem('{}')).toBe('not-a-backup')
    expect(problem('null')).toBe('not-a-backup')
    expect(
      problem(JSON.stringify({ app: 'other', schemaVersion: 1, stores: {} })),
    ).toBe('not-a-backup')
    const incomplete = JSON.parse(await valid())
    delete incomplete.stores.events
    expect(problem(JSON.stringify(incomplete))).toBe('not-a-backup')
  })
})

describe('deleting everything', () => {
  it('empties every store', async () => {
    await fill(db)
    const data = createDataStore(db)
    await data.deleteAll()
    expect(await createProfileStore(db).get()).toBeUndefined()
    expect(await createEventLog(db).list()).toEqual([])
    expect(await createLibraryStore(db).list()).toEqual([])
    expect(await createProgressStore(db).list()).toEqual([])
    expect(await createHighlightStore(db).listForWork('w1')).toEqual([])
    // Settings are back to the defaults.
    expect((await createSettingsStore(db).get()).theme).toBe('system')
  })
})
