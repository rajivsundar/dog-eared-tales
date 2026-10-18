import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { type ProfileBackup, firstDifference } from './backup'
import { createEventLog } from './eventLog'
import { createLibraryStore } from './libraryStore'
import { ProfileError } from './profileManager'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'
import { fakeSession, newTestManager, testNames } from './testDb'

function setup(extra = {}) {
  const names = testNames()
  const session = fakeSession()
  let clock = 1_000_000
  const manager = newTestManager({
    ...names,
    session,
    now: () => clock++,
    ...extra,
  })
  return {
    names,
    session,
    manager,
    tick: (ms: number) => (clock += ms),
    events: manager.forward(createEventLog),
    library: manager.forward(createLibraryStore),
    progress: manager.forward(createProgressStore),
    settings: manager.forward(createSettingsStore),
  }
}

const idOf = (m: ReturnType<typeof setup>['manager'], name: string) =>
  m.current().profiles.find((p) => p.name === name)!.id

describe('reading profiles: the list', () => {
  it('starts with "Me", and adds profiles with a default name and colour', async () => {
    const { manager } = setup()
    await manager.ready()
    expect(manager.suggestName()).toBe('Reader 2')
    const second = await manager.create()
    expect(second.name).toBe('Reader 2')
    expect(second.color).not.toBe(manager.current().profiles[0].color)
    expect(manager.suggestName()).toBe('Reader 3')
    manager.close()
  })

  it('keeps names to 1–20 characters, unique ignoring case', async () => {
    const { manager } = setup()
    await manager.ready()
    await expect(manager.create({ name: '   ' })).rejects.toMatchObject({
      code: 'name-empty',
    })
    await expect(
      manager.create({ name: 'x'.repeat(21) }),
    ).rejects.toMatchObject({ code: 'name-long' })
    await manager.create({ name: 'x'.repeat(20) })
    await expect(manager.create({ name: ' ME ' })).rejects.toMatchObject({
      code: 'name-taken',
    })
    const sam = await manager.create({ name: 'Sam' })
    await expect(manager.rename(sam.id, 'me')).rejects.toBeInstanceOf(
      ProfileError,
    )
    // Renaming to its own name in another case is fine.
    expect((await manager.rename(sam.id, 'SAM')).name).toBe('SAM')
    manager.close()
  })

  it('allows 6 profiles and no more', async () => {
    const { manager } = setup()
    await manager.ready()
    for (let i = 2; i <= 6; i++) await manager.create()
    expect(manager.current().profiles).toHaveLength(6)
    await expect(manager.create()).rejects.toMatchObject({ code: 'too-many' })
    manager.close()
  })

  it('recolours, and refuses a colour that is not one of the six', async () => {
    const { manager } = setup()
    await manager.ready()
    const id = manager.current().profiles[0].id
    expect((await manager.recolor(id, 'plum')).color).toBe('plum')
    await expect(
      manager.recolor(id, 'neon' as unknown as 'plum'),
    ).rejects.toMatchObject({ code: 'bad-color' })
    manager.close()
  })

  it('remembers the list and the open profile after a restart', async () => {
    const { manager, names, session } = setup()
    await manager.ready()
    const sam = await manager.create({ name: 'Sam' })
    await manager.switchTo(sam.id)
    manager.close()
    const again = newTestManager({ ...names, session })
    await again.ready()
    expect(again.current().profiles.map((p) => p.name)).toEqual(['Me', 'Sam'])
    expect(again.current().active?.name).toBe('Sam')
    again.close()
  })
})

describe('switching profiles: nothing leaks', () => {
  it("keeps each profile's taste, Library, progress and settings apart", async () => {
    const { manager, events, library, progress, settings } = setup()
    await manager.ready()
    const me = idOf(manager, 'Me')
    const sam = (await manager.create({ name: 'Sam' })).id

    await events.append({ workId: 'me-story', type: 'love' })
    await library.save('me-story')
    await progress.set({
      workId: 'me-story',
      locator: 'a',
      percent: 10,
      secondsRead: 5,
    })
    await settings.update({ theme: 'night' })

    await manager.switchTo(sam)
    expect(await events.list()).toEqual([])
    expect(await library.list()).toEqual([])
    expect(await progress.list()).toEqual([])
    expect((await settings.get()).theme).toBe('system')

    await events.append({ workId: 'sam-story', type: 'finished' })
    await library.save('sam-story')
    await settings.update({ theme: 'sepia' })

    await manager.switchTo(me)
    expect((await events.list()).map((e) => e.workId)).toEqual(['me-story'])
    expect((await library.list()).map((w) => w.workId)).toEqual(['me-story'])
    expect((await progress.list()).map((p) => p.workId)).toEqual(['me-story'])
    expect((await settings.get()).theme).toBe('night')
    manager.close()
  })

  it('lands a write queued during a switch on the profile that made it', async () => {
    const { manager, library, events } = setup()
    await manager.ready()
    const sam = (await manager.create({ name: 'Sam' })).id
    const me = idOf(manager, 'Me')

    // The write is started, then the switch begins before the write has finished.
    const write = library.save('queued-by-me')
    const swap = manager.switchTo(sam)
    const late = library.save('queued-during-switch')
    await Promise.all([write, swap, late])

    expect(await library.list()).toEqual([]) // Sam sees nothing of Me's.
    await events.append({ workId: 'sam-only', type: 'open' })
    await manager.switchTo(me)
    expect((await library.list()).map((w) => w.workId).sort()).toEqual([
      'queued-by-me',
      'queued-during-switch',
    ])
    expect((await events.list()).map((e) => e.workId)).not.toContain('sam-only')
    manager.close()
  })

  it('counts a switch in the epoch, so screens start fresh', async () => {
    const { manager } = setup()
    await manager.ready()
    const sam = (await manager.create()).id
    const before = manager.current().epoch
    await manager.switchTo(sam)
    expect(manager.current().epoch).toBeGreaterThan(before)
    manager.close()
  })

  it('tells subscribers when the open profile changes', async () => {
    const { manager } = setup()
    await manager.ready()
    const sam = (await manager.create({ name: 'Sam' })).id
    const seen: (string | undefined)[] = []
    const stop = manager.subscribe(() =>
      seen.push(manager.current().active?.name),
    )
    await manager.switchTo(sam)
    stop()
    expect(seen).toContain('Sam')
    manager.close()
  })
})

describe('deleting a profile', () => {
  it('removes its reading and its database, and leaves the others', async () => {
    const { manager, names, library } = setup()
    await manager.ready()
    const me = idOf(manager, 'Me')
    await library.save('mine')
    const sam = (await manager.create({ name: 'Sam' })).id
    await manager.switchTo(sam)
    await library.save('sams')
    await manager.switchTo(me)

    await manager.remove(sam)
    expect(manager.current().profiles.map((p) => p.name)).toEqual(['Me'])
    expect(await Dexie.exists(names.profilePrefix + sam)).toBe(false)
    expect((await library.list()).map((w) => w.workId)).toEqual(['mine'])
    manager.close()
  })

  it('deleting the open profile opens another one', async () => {
    const { manager, library } = setup()
    await manager.ready()
    const me = idOf(manager, 'Me')
    await library.save('mine')
    const sam = (await manager.create({ name: 'Sam' })).id
    await manager.switchTo(sam)
    await manager.remove(sam)
    expect(manager.current().active?.id).toBe(me)
    expect((await library.list()).map((w) => w.workId)).toEqual(['mine'])
    manager.close()
  })

  it('never deletes the last profile', async () => {
    const { manager } = setup()
    await manager.ready()
    await expect(
      manager.remove(manager.current().profiles[0].id),
    ).rejects.toMatchObject({ code: 'last-profile' })
    manager.close()
  })

  it('a tab whose profile was deleted elsewhere returns to the picker', async () => {
    const names = testNames()
    const one = newTestManager({
      ...names,
      channelName: 'ch-' + names.registryName,
    })
    const two = newTestManager({
      ...names,
      channelName: 'ch-' + names.registryName,
    })
    await one.ready()
    await two.ready()
    const sam = (await one.create({ name: 'Sam' })).id
    await two.list()
    await one.switchTo(idOf(one, 'Me'))
    await two.switchTo(sam)
    expect(two.current().active?.name).toBe('Sam')
    await one.remove(sam)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(two.current().mode).toBe('none')
    expect(two.current().active).toBeNull()
    await expect(two.forward(createEventLog).list()).rejects.toBeInstanceOf(
      ProfileError,
    )
    one.close()
    two.close()
  })
})

describe('guest mode', () => {
  it('leaves no trace in anyone’s profile or in the registry', async () => {
    const { manager, names, events, library } = setup()
    await manager.ready()
    const me = idOf(manager, 'Me')
    await manager.create({ name: 'Sam' })
    await library.save('mine')
    const activeBefore = manager.current().active?.id
    const profileDbsBefore = (await Dexie.getDatabaseNames()).filter((n) =>
      n.startsWith(names.profilePrefix),
    )

    await manager.startGuest()
    expect(manager.current().mode).toBe('guest')
    expect(await library.list()).toEqual([]) // the guest starts empty
    await library.save('guest-story')
    await events.append({ workId: 'guest-story', type: 'finished' })
    expect(
      (await Dexie.getDatabaseNames()).some((n) =>
        n.startsWith(names.guestPrefix),
      ),
    ).toBe(true)

    await manager.switchTo(me)
    expect(manager.current().mode).toBe('profile')
    expect(manager.current().active?.id).toBe(activeBefore)
    expect((await library.list()).map((w) => w.workId)).toEqual(['mine'])
    expect((await events.list()).map((e) => e.workId)).not.toContain(
      'guest-story',
    )
    // The guest database is gone; the registry and the profile databases are as they were.
    const names2 = await Dexie.getDatabaseNames()
    expect(names2.some((n) => n.startsWith(names.guestPrefix))).toBe(false)
    expect(names2.filter((n) => n.startsWith(names.profilePrefix))).toEqual(
      profileDbsBefore,
    )
    expect((await manager.getPersistence()) ?? null).toBeNull()
    manager.close()
  })

  it('ends when the reader switches back (endGuest) and deletes its database', async () => {
    const { manager, names, session } = setup()
    await manager.ready()
    await manager.startGuest()
    expect(session.getItem('dog-eared-tales-guest')).toMatch(names.guestPrefix)
    await manager.endGuest()
    expect(manager.current().mode).toBe('profile')
    expect(session.getItem('dog-eared-tales-guest')).toBeNull()
    expect(
      (await Dexie.getDatabaseNames()).some((n) =>
        n.startsWith(names.guestPrefix),
      ),
    ).toBe(false)
    manager.close()
  })

  it('survives a reload in the same tab, with what the guest did', async () => {
    const { manager, names, session, library } = setup()
    await manager.ready()
    await manager.startGuest()
    await library.save('guest-story')
    manager.close()

    // The page reloads: a new manager, the same tab's session storage.
    const reloaded = newTestManager({ ...names, session })
    await reloaded.ready()
    expect(reloaded.current().mode).toBe('guest')
    expect(
      (await reloaded.forward(createLibraryStore).list()).map((w) => w.workId),
    ).toEqual(['guest-story'])
    reloaded.close()
  })

  it('is cleaned up on the next launch after the tab or app was closed', async () => {
    const { manager, names } = setup()
    await manager.ready()
    await manager.startGuest()
    await manager.forward(createLibraryStore).save('left-behind')
    manager.close()

    // A new tab has new session storage: the guest flag is gone, the database is a leftover.
    expect(
      (await Dexie.getDatabaseNames()).some((n) =>
        n.startsWith(names.guestPrefix),
      ),
    ).toBe(true)
    const next = newTestManager({ ...names, session: fakeSession() })
    await next.ready()
    expect(next.current().mode).toBe('profile')
    expect(
      (await Dexie.getDatabaseNames()).some((n) =>
        n.startsWith(names.guestPrefix),
      ),
    ).toBe(false)
    next.close()
  })

  it('does not count as a choice made for "Who’s reading?" to ask again', async () => {
    const { manager } = setup()
    await manager.ready()
    await manager.create()
    await manager.startGuest()
    expect(manager.current().askWho).toBe(false)
    manager.close()
  })
})

describe('"Who’s reading?" timing', () => {
  it('is never asked with one profile', async () => {
    const { manager, tick } = setup()
    await manager.ready()
    expect(manager.current().askWho).toBe(false)
    manager.noteAway()
    tick(2 * 60 * 60 * 1000)
    manager.noteBack()
    expect(manager.current().askWho).toBe(false)
    manager.close()
  })

  it('is asked once per browser session when 2+ profiles exist', async () => {
    const { manager, names } = setup()
    await manager.ready()
    await manager.create({ name: 'Sam' })
    manager.close()

    const fresh = fakeSession() // a new browser session
    const first = newTestManager({ ...names, session: fresh })
    await first.ready()
    expect(first.current().askWho).toBe(true)
    await first.switchTo(idOf(first, 'Sam')) // answered
    expect(first.current().askWho).toBe(false)
    first.close()

    // A reload in the same session does not ask again.
    const reload = newTestManager({ ...names, session: fresh })
    await reload.ready()
    expect(reload.current().askWho).toBe(false)
    reload.close()
  })

  it('is asked again after 30 minutes away, not after 29', async () => {
    const { manager, tick } = setup()
    await manager.ready()
    await manager.create({ name: 'Sam' })
    manager.markPicked()
    expect(manager.current().askWho).toBe(false)

    manager.noteAway()
    tick(29 * 60 * 1000)
    manager.noteBack()
    expect(manager.current().askWho).toBe(false)

    manager.noteAway()
    tick(30 * 60 * 1000)
    manager.noteBack()
    expect(manager.current().askWho).toBe(true)

    manager.markPicked()
    expect(manager.current().askWho).toBe(false)
    manager.close()
  })
})

describe('export and import', () => {
  it('exports one profile with its name and colour', async () => {
    const { manager, library } = setup()
    await manager.ready()
    await library.save('mine')
    const file = await manager.exportProfile()
    expect(file.kind).toBe('profile')
    expect(file.name).toBe('Me')
    expect(file.schemaVersion).toBe(2)
    expect(file.stores.library.map((w) => w.workId)).toEqual(['mine'])
    manager.close()
  })

  it('adds a one-profile file as a new profile, leaving the open one alone', async () => {
    const { manager, library } = setup()
    await manager.ready()
    await library.save('mine')
    const file = await manager.exportProfile()
    const added = await manager.importAsNewProfile({
      ...file,
      name: 'Me',
      color: file.color,
    })
    expect(added.name).toBe('Me (2)')
    expect(manager.current().profiles).toHaveLength(2)
    expect(manager.current().active?.name).toBe('Me')
    await manager.switchTo(added.id)
    expect((await library.list()).map((w) => w.workId)).toEqual(['mine'])
    manager.close()
  })

  it('adds a version 1 file (no name) as "Imported"', async () => {
    const { manager, library } = setup()
    await manager.ready()
    await library.save('mine')
    const { stores } = await manager.exportProfile()
    const v1: ProfileBackup = {
      app: 'dog-eared-tales',
      schemaVersion: 1,
      kind: 'profile',
      exportedAt: 'x',
      stores,
    }
    const added = await manager.importAsNewProfile(v1)
    expect(added.name).toBe('Imported')
    manager.close()
  })

  it('refuses to add a seventh profile', async () => {
    const { manager } = setup()
    await manager.ready()
    for (let i = 2; i <= 6; i++) await manager.create()
    await expect(
      manager.importAsNewProfile(await manager.exportProfile()),
    ).rejects.toMatchObject({ code: 'too-many' })
    manager.close()
  })

  it('"Replace this profile" swaps the open profile’s reading, keeping its name', async () => {
    const { manager, library } = setup()
    await manager.ready()
    await library.save('old')
    const file = await manager.exportProfile()
    await library.save('newer')
    await manager.replaceProfileWith({ ...file, name: 'Someone else' })
    expect((await library.list()).map((w) => w.workId)).toEqual(['old'])
    expect(manager.current().active?.name).toBe('Me')
    manager.close()
  })

  it('exports all profiles and replaces everything from the file', async () => {
    const { manager, library } = setup()
    await manager.ready()
    await library.save('mine')
    const sam = (await manager.create({ name: 'Sam' })).id
    await manager.switchTo(sam)
    await library.save('sams')
    const all = await manager.exportAllProfiles()
    expect(all.kind).toBe('all')
    expect(all.profiles.map((p) => p.name)).toEqual(['Me', 'Sam'])
    expect(all.activeIndex).toBe(1)

    // Change things, then bring the file back.
    await library.save('extra')
    await manager.create({ name: 'Temp' })
    await manager.replaceEverythingWith(JSON.parse(JSON.stringify(all)))
    expect(manager.current().profiles.map((p) => p.name)).toEqual(['Me', 'Sam'])
    expect(manager.current().active?.name).toBe('Sam')
    expect((await library.list()).map((w) => w.workId)).toEqual(['sams'])
    await manager.switchTo(idOf(manager, 'Me'))
    expect((await library.list()).map((w) => w.workId)).toEqual(['mine'])
    manager.close()
  })

  it('round-trips a profile with no differences', async () => {
    const { manager, library, events } = setup()
    await manager.ready()
    await library.save('a')
    await events.append({ workId: 'a', type: 'love', at: 5 })
    const file = await manager.exportProfile()
    const added = await manager.importAsNewProfile(file)
    await manager.switchTo(added.id)
    const copy = await manager.exportProfile()
    expect(firstDifference(file.stores, copy.stores)).toBeNull()
    manager.close()
  })
})

describe('delete everything', () => {
  it('removes every profile, guest leftovers and the registry, then starts a fresh "Me"', async () => {
    const { manager, names, library, session } = setup()
    await manager.ready()
    await library.save('mine')
    await manager.create({ name: 'Sam' })
    await manager.setPersistence({ requested: true, granted: true })
    await manager.startGuest()

    await manager.deleteEverything()
    expect(manager.current().profiles.map((p) => p.name)).toEqual(['Me'])
    expect(manager.current().mode).toBe('profile')
    expect(session.getItem('dog-eared-tales-guest')).toBeNull()
    expect(await library.list()).toEqual([])
    expect(await manager.getPersistence()).toBeUndefined()
    const left = (await Dexie.getDatabaseNames()).filter(
      (n) =>
        n.startsWith(names.profilePrefix) || n.startsWith(names.guestPrefix),
    )
    expect(left).toHaveLength(1)
    manager.close()
  })
})

describe('one reader: nothing new to see', () => {
  it('has one profile, no picker, and the stores work as before', async () => {
    const { manager, library } = setup()
    await manager.ready()
    const now = manager.current()
    expect(now.profiles).toHaveLength(1)
    expect(now.askWho).toBe(false)
    expect(now.mode).toBe('profile')
    await library.save('x')
    expect((await library.list())[0].workId).toBe('x')
    manager.close()
  })
})

describe('each tab keeps its own open profile', () => {
  it('two tabs on different profiles: reloading one keeps it on its profile', async () => {
    const names = testNames()
    const tabA = fakeSession()
    const tabB = fakeSession()
    const a = newTestManager({ ...names, session: tabA })
    await a.ready()
    const sam = (await a.create({ name: 'Sam' })).id
    const me = idOf(a, 'Me')
    await a.switchTo(sam)

    const b = newTestManager({ ...names, session: tabB })
    await b.ready()
    await b.switchTo(me) // tab B is on Me; the most recently used is now Me
    expect(b.current().active?.name).toBe('Me')

    // Tab A reloads: same session storage, new manager. It stays on Sam.
    a.close()
    const reloadedA = newTestManager({ ...names, session: tabA })
    await reloadedA.ready()
    expect(reloadedA.current().active?.name).toBe('Sam')
    // Tab B reloads and stays on Me.
    b.close()
    const reloadedB = newTestManager({ ...names, session: tabB })
    await reloadedB.ready()
    expect(reloadedB.current().active?.name).toBe('Me')

    // A brand new tab opens the most recently used profile (Me, the last one chosen).
    const fresh = newTestManager({ ...names, session: fakeSession() })
    await fresh.ready()
    expect(fresh.current().active?.name).toBe('Me')
    reloadedA.close()
    reloadedB.close()
    fresh.close()
  })
})
