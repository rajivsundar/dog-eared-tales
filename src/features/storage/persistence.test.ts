import { describe, expect, it, vi } from 'vitest'
import { fakeStores } from '../shortlist/fakeStores'
import {
  formatBytes,
  readStorageStatus,
  requestPersistenceIfEarned,
} from './persistence'

// The request that is running is shared module-wide, so each test starts from a clean fake.
function setup(persist: () => Promise<boolean> = async () => true) {
  const s = fakeStores()
  const storage = { persist: vi.fn(persist) }
  const deps = {
    persistence: s.profileManager,
    events: s.eventLog,
    storage,
  }
  return { s, storage, deps }
}
const persistence = (s: ReturnType<typeof fakeStores>) =>
  s.profileManager.getPersistence()

describe('asking the browser to protect the data', () => {
  it('does not ask before the first Dog-ear or finished work', async () => {
    const { s, storage, deps } = setup()
    await s.eventLog.append({ workId: 'w1', type: 'open' })
    await s.eventLog.append({ workId: 'w1', type: 'tap' })
    await requestPersistenceIfEarned(deps)
    expect(storage.persist).not.toHaveBeenCalled()
    expect(await persistence(s)).toBeUndefined()
  })

  it('asks after the first Dog-ear, and keeps the answer', async () => {
    const { s, storage, deps } = setup(async () => true)
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    await requestPersistenceIfEarned(deps)
    expect(storage.persist).toHaveBeenCalledTimes(1)
    expect(await persistence(s)).toEqual({ requested: true, granted: true })
  })

  it('asks after the first finished work, and keeps a "no" too', async () => {
    const { s, storage, deps } = setup(async () => false)
    await s.eventLog.append({ workId: 'w1', type: 'finished' })
    await requestPersistenceIfEarned(deps)
    expect(storage.persist).toHaveBeenCalledTimes(1)
    expect(await persistence(s)).toEqual({ requested: true, granted: false })
  })

  it('calls persist() only once, however often it is triggered', async () => {
    const { s, storage, deps } = setup()
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    // Overlapping triggers share one request...
    await Promise.all([
      requestPersistenceIfEarned(deps),
      requestPersistenceIfEarned(deps),
      requestPersistenceIfEarned(deps),
    ])
    // ...and later ones see that it was already asked.
    await requestPersistenceIfEarned(deps)
    await s.eventLog.append({ workId: 'w2', type: 'finished' })
    await requestPersistenceIfEarned(deps)
    await s.eventLog.append({ workId: 'w3', type: 'save' })
    await requestPersistenceIfEarned(deps)
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('does not ask again on a later visit, even if the first answer was no', async () => {
    const { s, storage, deps } = setup(async () => false)
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    await requestPersistenceIfEarned(deps)
    // A later visit: the same settings, a new call.
    await requestPersistenceIfEarned({ ...deps })
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('marks it as asked before the answer arrives, so a second tab cannot ask too', async () => {
    let answer: (granted: boolean) => void = () => {}
    const { s, storage, deps } = setup(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    const asking = requestPersistenceIfEarned(deps)
    await vi.waitFor(async () =>
      expect((await persistence(s))?.requested).toBe(true),
    )
    answer(true)
    await asking
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the browser has no persist()', async () => {
    const s = fakeStores()
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    await requestPersistenceIfEarned({
      persistence: s.profileManager,
      events: s.eventLog,
      storage: {} as never,
    })
    expect(await persistence(s)).toBeUndefined()
  })

  it('never asks for a guest, whatever they do', async () => {
    const { s, storage, deps } = setup()
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    await requestPersistenceIfEarned({ ...deps, isGuest: () => true })
    expect(storage.persist).not.toHaveBeenCalled()
    expect(await persistence(s)).toBeUndefined()
  })

  it('never throws', async () => {
    const { s, deps } = setup(async () => {
      throw new Error('blocked')
    })
    await s.eventLog.append({ workId: 'w1', type: 'save' })
    await expect(requestPersistenceIfEarned(deps)).resolves.toBeUndefined()
  })
})

describe('what Settings → Storage shows', () => {
  it('reads the protection state and the space used from the browser', async () => {
    const status = await readStorageStatus({
      persisted: async () => true,
      estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 1e9 }),
    })
    expect(status).toEqual({ persisted: true, usage: 5 * 1024 * 1024 })
  })

  it('copes with a browser that will not say', async () => {
    expect(await readStorageStatus({} as never)).toEqual({
      persisted: undefined,
      usage: undefined,
    })
    expect(
      await readStorageStatus({
        persisted: async () => {
          throw new Error('no')
        },
        estimate: async () => {
          throw new Error('no')
        },
      }),
    ).toEqual({ persisted: undefined, usage: undefined })
  })

  it('formats sizes in plain units', () => {
    expect(formatBytes(512)).toBe('1 KB')
    expect(formatBytes(150 * 1024)).toBe('150 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(12.34 * 1024 * 1024)).toBe('12.3 MB')
  })
})
