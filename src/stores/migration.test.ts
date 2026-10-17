import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { firstDifference, readStores } from './backup'
import { TwiceToldDB } from './db'
import { RegistryDB } from './registry'
import { createProfileManager } from './profileManager'
import {
  fakeSession,
  newTestManager,
  seedProfileData,
  testNames,
} from './testDb'

/** An old-style single database, filled with data, as an existing reader would have. */
async function makeLegacy(name: string, tag = 'old') {
  const legacy = new TwiceToldDB(name)
  await seedProfileData(legacy, tag)
  const before = await readStores(legacy)
  legacy.close()
  return before
}

const dataOf = async (name: string) => {
  const db = new TwiceToldDB(name)
  try {
    return await readStores(db)
  } finally {
    db.close()
  }
}

const profileDatabases = async (prefix: string) =>
  (await Dexie.getDatabaseNames()).filter((n) => n.startsWith(prefix))

describe('migrating the old single database into a profile "Me"', () => {
  it('copies every record, verifies it, and removes the old database last', async () => {
    const names = testNames()
    const before = await makeLegacy(names.legacyName)
    const total = Object.values(before).reduce((n, list) => n + list.length, 0)
    expect(total).toBeGreaterThanOrEqual(8)

    const manager = newTestManager(names)
    await manager.ready()
    const now = manager.current()
    expect(now.status).toBe('ready')
    expect(now.profiles.map((p) => p.name)).toEqual(['Me'])
    expect(now.active?.name).toBe('Me')

    // Every record of every store, before and after.
    const after = await dataOf(names.profilePrefix + now.active!.id)
    expect(firstDifference(before, after)).toBeNull()
    for (const store of Object.keys(before) as (keyof typeof before)[]) {
      expect(after[store]).toHaveLength(before[store].length)
    }
    console.info(
      `migration: ${total} records in ${Object.keys(before).length} stores copied; every record matches`,
    )

    // The old database is gone, and the stores read the copy.
    expect(await Dexie.exists(names.legacyName)).toBe(false)
    manager.close()
  })

  it('moves the "storage persistence was asked" flag to the registry', async () => {
    const names = testNames()
    await makeLegacy(names.legacyName)
    const manager = newTestManager(names)
    expect(await manager.getPersistence()).toEqual({
      requested: true,
      granted: true,
    })
    manager.close()
  })

  it('reads the migrated data through the stores', async () => {
    const names = testNames()
    await makeLegacy(names.legacyName, 'kept')
    const manager = newTestManager(names)
    const { createLibraryStore } = await import('./libraryStore')
    const library = manager.forward(createLibraryStore)
    expect((await library.list()).map((w) => w.workId)).toEqual(['kept-3'])
    manager.close()
  })

  it('takes a Web Lock for the migration', async () => {
    const names = testNames()
    await makeLegacy(names.legacyName)
    const taken: string[] = []
    const locks = {
      request: ((name: string, task: () => Promise<unknown>) => {
        taken.push(name)
        return task()
      }) as unknown as LockManager['request'],
    }
    const manager = newTestManager({ ...names, locks })
    await manager.ready()
    expect(taken).toEqual(['twice-told-profiles'])
    manager.close()
  })

  it('a second run changes nothing', async () => {
    const names = testNames()
    const before = await makeLegacy(names.legacyName)
    const session = fakeSession()
    const first = newTestManager({ ...names, session })
    await first.ready()
    const id = first.current().active!.id
    const migrated = await dataOf(names.profilePrefix + id)
    first.close()

    const second = newTestManager({ ...names, session })
    await second.ready()
    expect(second.current().profiles.map((p) => p.id)).toEqual([id])
    expect(second.current().active?.id).toBe(id)
    const again = await dataOf(names.profilePrefix + id)
    expect(firstDifference(migrated, again)).toBeNull()
    expect(firstDifference(before, again)).toBeNull()
    expect(await profileDatabases(names.profilePrefix)).toEqual([
      names.profilePrefix + id,
    ])
    second.close()
  })

  it('resumes after an interruption: the original is kept and the retry finishes', async () => {
    const names = testNames()
    const before = await makeLegacy(names.legacyName)

    // The app is killed after the copy, before the registry is written.
    const interrupted = newTestManager({
      ...names,
      hooks: {
        beforeCommit: () => {
          throw new Error('power cut')
        },
      },
    })
    await interrupted.ready()
    expect(interrupted.current().status).toBe('error')
    interrupted.close()

    // The original is untouched and there is no profile yet.
    expect(await Dexie.exists(names.legacyName)).toBe(true)
    expect(firstDifference(before, await dataOf(names.legacyName))).toBeNull()
    const registry = new RegistryDB(names.registryName)
    expect(await registry.profiles.count()).toBe(0)
    registry.close()

    // The next launch cleans the half-made copy and migrates properly.
    const retry = newTestManager(names)
    await retry.ready()
    expect(retry.current().status).toBe('ready')
    expect(retry.current().profiles.map((p) => p.name)).toEqual(['Me'])
    const id = retry.current().active!.id
    expect(await profileDatabases(names.profilePrefix)).toEqual([
      names.profilePrefix + id,
    ])
    expect(
      firstDifference(before, await dataOf(names.profilePrefix + id)),
    ).toBeNull()
    expect(await Dexie.exists(names.legacyName)).toBe(false)
    retry.close()
  })

  it('keeps the original when the check finds a difference', async () => {
    const names = testNames()
    const before = await makeLegacy(names.legacyName)
    const broken = newTestManager({
      ...names,
      hooks: {
        // A record goes missing in the copy.
        afterCopy: async (target) => {
          const [first] = await target.events.toArray()
          await target.events.delete(first.id)
        },
      },
    })
    await broken.ready()
    expect(broken.current().status).toBe('error')
    broken.close()

    expect(await Dexie.exists(names.legacyName)).toBe(true)
    expect(firstDifference(before, await dataOf(names.legacyName))).toBeNull()
    expect(await profileDatabases(names.profilePrefix)).toEqual([])
    const registry = new RegistryDB(names.registryName)
    expect(await registry.profiles.count()).toBe(0)
    registry.close()
  })

  it('finishes deleting the original if that last step was cut short', async () => {
    const names = testNames()
    await makeLegacy(names.legacyName)
    const first = newTestManager(names)
    await first.ready()
    first.close()
    // Put the original back, as if its deletion had not finished.
    await makeLegacy(names.legacyName, 'ghost')
    const second = newTestManager(names)
    await second.ready()
    expect(await Dexie.exists(names.legacyName)).toBe(false)
    expect(second.current().profiles).toHaveLength(1)
    second.close()
  })

  it('a fresh install silently gets an empty "Me"', async () => {
    const names = testNames()
    const manager = createProfileManager({
      ...names,
      session: fakeSession(),
      locks: null,
      channelName: null,
    })
    await manager.ready()
    expect(manager.current().profiles.map((p) => p.name)).toEqual(['Me'])
    const after = await dataOf(
      names.profilePrefix + manager.current().active!.id,
    )
    for (const list of Object.values(after)) expect(list).toEqual([])
    manager.close()
  })
})
