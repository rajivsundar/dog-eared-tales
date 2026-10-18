import Dexie from 'dexie'
import {
  type AllBackup,
  type BackupStores,
  type ProfileBackup,
  clearStores,
  firstDifference,
  readStores,
  replaceStores,
  BACKUP_SCHEMA_VERSION,
} from './backup'
import { DB_NAME, TwiceToldDB } from './db'
import { REGISTRY_NAME, RegistryDB } from './registry'
import {
  MAX_PROFILE_NAME,
  MAX_READING_PROFILES,
  PROFILE_COLORS,
  type ProfileColor,
  type ReadingProfile,
} from './types'

export type ProfileErrorCode =
  | 'name-empty'
  | 'name-long'
  | 'name-taken'
  | 'too-many'
  | 'last-profile'
  | 'not-found'
  | 'bad-color'
  | 'no-profile'

/** Why a reading-profile change was refused, with a plain-English message. */
export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ProfileError'
  }
}

/** What the screens read. A new object whenever anything in it changes. */
export interface ProfileSnapshot {
  status: 'loading' | 'ready' | 'error'
  /** 'profile': a reading profile is open. 'guest': the temporary guest. 'none': pick one. */
  mode: 'profile' | 'guest' | 'none'
  /** The open reading profile (null for the guest, or while none is open). */
  active: ReadingProfile | null
  /** Every reading profile, oldest first. */
  profiles: ReadingProfile[]
  /** Goes up whenever the open profile changes. Screens key on it, so they start fresh. */
  epoch: number
  /** True when "Who's reading?" should be shown now. */
  askWho: boolean
}

export interface ProfileManager {
  /** Resolves when the profiles are ready to use (never rejects; see `current().status`). */
  ready(): Promise<void>
  current(): ProfileSnapshot
  subscribe(listener: () => void): () => void

  list(): Promise<ReadingProfile[]>
  /** The name offered for a new profile: "Reader 2", "Reader 3", and so on. */
  suggestName(): string
  create(input?: {
    name?: string
    color?: ProfileColor
  }): Promise<ReadingProfile>
  rename(id: string, name: string): Promise<ReadingProfile>
  recolor(id: string, color: ProfileColor): Promise<ReadingProfile>
  switchTo(id: string): Promise<void>
  /** Deletes a profile and its reading. The last profile cannot be deleted. */
  remove(id: string): Promise<void>

  startGuest(): Promise<void>
  /** Leaves the guest and opens the profile that was open before. */
  endGuest(): Promise<void>

  /** "Who's reading?" has been answered for this browser session. */
  markPicked(): void
  /** The app was hidden (or came back). After 30 minutes away, "Who's reading?" is asked again. */
  noteAway(): void
  noteBack(): void

  /** Whether we have asked the browser to protect the data (one answer for the whole device). */
  getPersistence(): Promise<
    { requested: boolean; granted: boolean } | undefined
  >
  setPersistence(value: { requested: boolean; granted: boolean }): Promise<void>

  /** The open profile as a backup file. */
  exportProfile(): Promise<ProfileBackup>
  /** Replaces the open profile's reading with the backup's (keeps its name and colour). */
  replaceProfileWith(backup: ProfileBackup): Promise<void>
  /** Adds the backup as a new profile. */
  importAsNewProfile(backup: ProfileBackup): Promise<ReadingProfile>
  /** Wipes the open profile's reading (it stays, empty). */
  clearOpenProfile(): Promise<void>
  exportAllProfiles(): Promise<AllBackup>
  /** Replaces every profile on the device with the ones in the backup. All or nothing. */
  replaceEverythingWith(backup: AllBackup): Promise<void>
  /** Removes every profile, guest leftover and the registry, then starts a fresh "Me". */
  deleteEverything(): Promise<void>

  /**
   * Builds a store that always works on whichever profile is open when a call is made. A call
   * keeps the database it started on, and a switch waits for such calls to finish first.
   */
  forward<S extends object>(make: (db: TwiceToldDB) => S): S
  /** Closes everything (tests). */
  close(): void
}

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface ProfileManagerOptions {
  registryName?: string
  /** Each profile's database is this plus its id. */
  profilePrefix?: string
  /** The temporary guest database is this plus a random id. */
  guestPrefix?: string
  /** The single database used before profiles existed. */
  legacyName?: string
  /** Lives as long as the tab; null for none. */
  session?: SessionStorageLike | null
  /** Web Locks; null for none. */
  locks?: Pick<LockManager, 'request'> | null
  /** Tells other tabs about a change; null for none. */
  channelName?: string | null
  now?: () => number
  /** For tests: stop partway through the migration. */
  hooks?: {
    afterCopy?: (target: TwiceToldDB) => Promise<void> | void
    beforeCommit?: () => Promise<void> | void
  }
}

const GUEST_KEY = 'dog-eared-tales-guest'
const PICKED_KEY = 'dog-eared-tales-picked'
const OPEN_KEY = 'dog-eared-tales-open'
const LOCK_NAME = 'dog-eared-tales-profiles'
const AWAY_LIMIT = 30 * 60 * 1000

interface Active {
  mode: 'profile' | 'guest'
  id?: string
  dbName: string
  db: TwiceToldDB
}

function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export function createProfileManager(
  options: ProfileManagerOptions = {},
): ProfileManager {
  const registryName = options.registryName ?? REGISTRY_NAME
  const profilePrefix = options.profilePrefix ?? 'dog-eared-tales-p-'
  const guestPrefix = options.guestPrefix ?? 'dog-eared-tales-guest-'
  const legacyName = options.legacyName ?? DB_NAME
  const now = options.now ?? Date.now
  const session: SessionStorageLike | null =
    options.session === undefined ? safeSession() : options.session
  const locks =
    options.locks === undefined
      ? (globalThis.navigator?.locks ?? null)
      : options.locks
  const hooks = options.hooks ?? {}

  const registry = new RegistryDB(registryName)
  let status: ProfileSnapshot['status'] = 'loading'
  let active: Active | null = null
  let profiles: ReadingProfile[] = []
  let epoch = 0
  let picked = false
  let awaySince: number | null = null
  let snapshot: ProfileSnapshot = build()
  const listeners = new Set<() => void>()
  let closed = false

  // ---- state shown to the screens

  function build(): ProfileSnapshot {
    const open =
      active?.mode === 'profile'
        ? (profiles.find((p) => p.id === active?.id) ?? null)
        : null
    return {
      status,
      mode: active ? active.mode : 'none',
      active: open,
      profiles,
      epoch,
      askWho:
        status === 'ready' &&
        profiles.length >= 2 &&
        active?.mode !== 'guest' &&
        !picked,
    }
  }
  function emit(): void {
    snapshot = build()
    for (const listener of [...listeners]) listener()
  }

  // ---- calls in flight

  let inflight = 0
  let idleWaiters: (() => void)[] = []
  function track(): void {
    inflight++
  }
  function untrack(): void {
    inflight--
    if (inflight === 0) {
      const waiting = idleWaiters
      idleWaiters = []
      waiting.forEach((resume) => resume())
    }
  }
  const idle = (): Promise<void> =>
    inflight === 0
      ? Promise.resolve()
      : new Promise<void>((resume) => idleWaiters.push(resume))

  /**
   * Opens `next` as the current database once every call that started on the old one has
   * finished. Calls made while waiting still go to the old one; calls after it go to the new one.
   */
  async function swap(next: Active | null): Promise<void> {
    while (inflight > 0) await idle()
    const old = active
    active = next
    // This tab remembers its own open profile across reloads. A new tab starts from the most recently used.
    if (next?.mode === 'profile' && next.id) {
      try {
        session?.setItem(OPEN_KEY, next.id)
      } catch {
        /* private mode */
      }
    }
    epoch++
    old?.db.close()
    emit()
  }

  function run<T>(task: (db: TwiceToldDB) => Promise<T> | T): Promise<T> {
    if (status === 'loading') return ensureStarted().then(() => run(task))
    if (status === 'error' || !active) {
      return Promise.reject(
        new ProfileError('no-profile', 'No reading profile is open.'),
      )
    }
    const { db } = active
    track()
    return Promise.resolve()
      .then(() => task(db))
      .finally(untrack)
  }

  // ---- one change at a time

  let queue: Promise<unknown> = Promise.resolve()
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      await ensureStarted()
      return task()
    })
    queue = result.catch(() => {})
    return result
  }
  const withLock = <T>(task: () => Promise<T>): Promise<T> =>
    locks ? (locks.request(LOCK_NAME, task) as Promise<T>) : task()

  // ---- names, colours, ids

  const dbNameOf = (id: string): string => `${profilePrefix}${id}`

  function cleanName(name: string, exceptId?: string): string {
    const text = name.trim()
    if (!text) {
      throw new ProfileError('name-empty', 'Give this profile a name.')
    }
    if (text.length > MAX_PROFILE_NAME) {
      throw new ProfileError(
        'name-long',
        `Names can be up to ${MAX_PROFILE_NAME} characters.`,
      )
    }
    if (profiles.some((p) => p.id !== exceptId && sameName(p.name, text))) {
      throw new ProfileError(
        'name-taken',
        'Another profile already has that name.',
      )
    }
    return text
  }
  function suggestName(): string {
    for (let n = profiles.length + 1; ; n++) {
      const name = `Reader ${n}`
      if (!profiles.some((p) => sameName(p.name, name))) return name
    }
  }
  /** A name from a backup that fits the rules: shortened and made different if needed. */
  function fitName(wanted: string | undefined, taken: string[]): string {
    const base = (wanted?.trim() || 'Imported')
      .slice(0, MAX_PROFILE_NAME)
      .trim()
    let name = base || 'Imported'
    for (let n = 2; taken.some((t) => sameName(t, name)); n++) {
      const suffix = ` (${n})`
      name = `${base.slice(0, MAX_PROFILE_NAME - suffix.length).trim()}${suffix}`
    }
    return name
  }
  function freeColor(used: ProfileColor[]): ProfileColor {
    return (
      PROFILE_COLORS.find((c) => !used.includes(c.id))?.id ??
      PROFILE_COLORS[used.length % PROFILE_COLORS.length].id
    )
  }
  const knownColor = (color: ProfileColor): void => {
    if (!PROFILE_COLORS.some((c) => c.id === color)) {
      throw new ProfileError('bad-color', 'Pick one of the colours listed.')
    }
  }

  // ---- other tabs

  let channel: BroadcastChannel | null = null
  const channelName =
    options.channelName === undefined ? LOCK_NAME : options.channelName
  if (channelName && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = () => {
        void refresh()
      }
    } catch {
      channel = null
    }
  }
  const tellOtherTabs = (): void => {
    try {
      channel?.postMessage('changed')
    } catch {
      /* closed */
    }
  }

  /** Reads the list again (another tab may have changed it). A deleted open profile closes. */
  async function refresh(): Promise<void> {
    if (closed || status !== 'ready') return
    try {
      profiles = await registry.profiles.orderBy('createdAt').toArray()
    } catch {
      return
    }
    if (
      active?.mode === 'profile' &&
      !profiles.some((p) => p.id === active?.id)
    ) {
      await swap(null)
    } else {
      emit()
    }
  }

  // ---- starting up

  async function allDatabases(): Promise<string[]> {
    try {
      return await Dexie.getDatabaseNames()
    } catch {
      return []
    }
  }
  const deleteDatabase = (name: string): Promise<void> =>
    Dexie.delete(name).catch((error: unknown) => {
      console.debug('could not delete a database', name, error)
    })

  async function insertProfile(
    name: string,
    color: ProfileColor,
    id: string = randomId(),
  ): Promise<ReadingProfile> {
    const stamp = now()
    const profile: ReadingProfile = {
      id,
      name,
      color,
      createdAt: stamp,
      lastUsedAt: stamp,
    }
    await registry.profiles.put(profile)
    return profile
  }

  /** Copies the single pre-profiles database into a new profile "Me". Legacy data is kept until verified. */
  async function migrateLegacy(): Promise<void> {
    const source = new TwiceToldDB(legacyName)
    const id = randomId()
    const target = new TwiceToldDB(dbNameOf(id))
    try {
      const before = await readStores(source)
      await replaceStores(target, before)
      await hooks.afterCopy?.(target)
      const after = await readStores(target)
      const difference = firstDifference(before, after)
      if (difference) {
        throw new Error(`The copy does not match the original (${difference}).`)
      }
      await hooks.beforeCommit?.()
      // Writing the registry is the commit point.
      const stamp = now()
      await registry.transaction(
        'rw',
        [registry.profiles, registry.meta],
        async () => {
          await registry.profiles.put({
            id,
            name: 'Me',
            color: 'rust',
            createdAt: stamp,
            lastUsedAt: stamp,
          })
          await registry.meta.put({ key: 'active', value: id })
          await registry.meta.put({ key: 'migrated', value: legacyName })
          const saved = before.settings[0]?.persistence
          if (saved)
            await registry.meta.put({ key: 'persistence', value: saved })
        },
      )
    } catch (error) {
      // Not committed: forget the copy. The original is untouched, so the next launch retries.
      target.close()
      await deleteDatabase(dbNameOf(id))
      throw error
    } finally {
      source.close()
      target.close()
    }
    await deleteDatabase(legacyName)
  }

  async function start(): Promise<void> {
    // A guest database left by a closed tab or app is cleaned up. This tab's own guest is kept.
    const kept = session?.getItem(GUEST_KEY) ?? null
    const names = await allDatabases()
    await Promise.all(
      names
        .filter((n) => n.startsWith(guestPrefix) && n !== kept)
        .map(deleteDatabase),
    )

    await withLock(async () => {
      const count = await registry.profiles.count()
      const legacyExists = await Dexie.exists(legacyName)
      if (count === 0) {
        // Partial copies from an interrupted migration or a failed first start.
        await Promise.all(
          names.filter((n) => n.startsWith(profilePrefix)).map(deleteDatabase),
        )
        if (legacyExists) {
          await migrateLegacy()
        } else {
          const me = await insertProfile('Me', 'rust')
          await registry.meta.put({ key: 'active', value: me.id })
        }
      } else {
        const known = new Set(
          (await registry.profiles.toArray()).map((p) => dbNameOf(p.id)),
        )
        await Promise.all(
          names
            .filter((n) => n.startsWith(profilePrefix) && !known.has(n))
            .map(deleteDatabase),
        )
        // A finished migration whose last step (deleting the original) was cut short.
        if (legacyExists && (await registry.meta.get('migrated'))) {
          await deleteDatabase(legacyName)
        }
      }
    })

    profiles = await registry.profiles.orderBy('createdAt').toArray()
    picked = session?.getItem(PICKED_KEY) === '1' || profiles.length < 2
    if (picked) session?.setItem(PICKED_KEY, '1')

    if (kept) {
      active = { mode: 'guest', dbName: kept, db: new TwiceToldDB(kept) }
    } else {
      const wanted =
        session?.getItem(OPEN_KEY) ?? (await registry.meta.get('active'))?.value
      const open =
        profiles.find((p) => p.id === wanted) ??
        [...profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0]
      active = {
        mode: 'profile',
        id: open.id,
        dbName: dbNameOf(open.id),
        db: new TwiceToldDB(dbNameOf(open.id)),
      }
    }
    epoch++
    status = 'ready'
    emit()
  }

  let started: Promise<void> | null = null
  /** Opens the registry the first time anything needs it. */
  function ensureStarted(): Promise<void> {
    started ??= start().catch((error: unknown) => {
      console.error('could not open the reading profiles', error)
      status = 'error'
      emit()
    })
    return started
  }

  // ---- the manager

  const markPicked = (): void => {
    picked = true
    awaySince = null
    try {
      session?.setItem(PICKED_KEY, '1')
    } catch {
      /* private mode */
    }
    emit()
  }

  async function touch(id: string): Promise<void> {
    const stamp = now()
    await registry.transaction(
      'rw',
      [registry.profiles, registry.meta],
      async () => {
        await registry.profiles.update(id, { lastUsedAt: stamp })
        await registry.meta.put({ key: 'active', value: id })
      },
    )
    profiles = profiles.map((p) =>
      p.id === id ? { ...p, lastUsedAt: stamp } : p,
    )
  }

  async function openProfile(id: string): Promise<void> {
    const wasGuest = active?.mode === 'guest' ? active.dbName : null
    await touch(id)
    if (!(active?.mode === 'profile' && active.id === id)) {
      await swap({
        mode: 'profile',
        id,
        dbName: dbNameOf(id),
        db: new TwiceToldDB(dbNameOf(id)),
      })
    }
    if (wasGuest) {
      session?.removeItem(GUEST_KEY)
      await deleteDatabase(wasGuest)
    }
    markPicked()
    tellOtherTabs()
  }

  const profileOrThrow = (id: string): ReadingProfile => {
    const found = profiles.find((p) => p.id === id)
    if (!found)
      throw new ProfileError('not-found', 'That profile is not on this device.')
    return found
  }

  /** Fills a profile's database with the stores, checks the copy and closes it. */
  async function fillProfile(id: string, stores: BackupStores): Promise<void> {
    const db = new TwiceToldDB(dbNameOf(id))
    try {
      await replaceStores(db, stores)
      const difference = firstDifference(stores, await readStores(db))
      if (difference)
        throw new Error(`The import did not match (${difference}).`)
    } finally {
      db.close()
    }
  }

  const manager: ProfileManager = {
    ready: () => ensureStarted(),
    current: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async list() {
      await ensureStarted()
      profiles = await registry.profiles.orderBy('createdAt').toArray()
      emit()
      return profiles
    },
    suggestName,

    create(input = {}) {
      return exclusive(async () => {
        profiles = await registry.profiles.orderBy('createdAt').toArray()
        if (profiles.length >= MAX_READING_PROFILES) {
          throw new ProfileError(
            'too-many',
            `Dog-Eared Tales keeps up to ${MAX_READING_PROFILES} profiles on one device.`,
          )
        }
        const name = cleanName(input.name ?? suggestName())
        if (input.color) knownColor(input.color)
        const color = input.color ?? freeColor(profiles.map((p) => p.color))
        const profile = await insertProfile(name, color)
        profiles = [...profiles, profile]
        emit()
        tellOtherTabs()
        return profile
      })
    },

    rename(id, name) {
      return exclusive(async () => {
        profileOrThrow(id)
        const clean = cleanName(name, id)
        await registry.profiles.update(id, { name: clean })
        profiles = profiles.map((p) =>
          p.id === id ? { ...p, name: clean } : p,
        )
        emit()
        tellOtherTabs()
        return profileOrThrow(id)
      })
    },

    recolor(id, color) {
      return exclusive(async () => {
        profileOrThrow(id)
        knownColor(color)
        await registry.profiles.update(id, { color })
        profiles = profiles.map((p) => (p.id === id ? { ...p, color } : p))
        emit()
        tellOtherTabs()
        return profileOrThrow(id)
      })
    },

    switchTo(id) {
      return exclusive(async () => {
        profileOrThrow(id)
        await openProfile(id)
      })
    },

    remove(id) {
      return exclusive(async () => {
        profileOrThrow(id)
        if (profiles.length <= 1) {
          throw new ProfileError(
            'last-profile',
            'This is the only profile. To start over, use Delete all my data.',
          )
        }
        if (active?.mode === 'profile' && active.id === id) {
          const next = [...profiles]
            .filter((p) => p.id !== id)
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0]
          await touch(next.id)
          await swap({
            mode: 'profile',
            id: next.id,
            dbName: dbNameOf(next.id),
            db: new TwiceToldDB(dbNameOf(next.id)),
          })
        }
        await registry.profiles.delete(id)
        profiles = profiles.filter((p) => p.id !== id)
        emit()
        tellOtherTabs()
        await deleteDatabase(dbNameOf(id))
      })
    },

    startGuest() {
      return exclusive(async () => {
        if (active?.mode === 'guest') return
        const dbName = `${guestPrefix}${randomId()}`
        session?.setItem(GUEST_KEY, dbName)
        await swap({ mode: 'guest', dbName, db: new TwiceToldDB(dbName) })
        markPicked()
      })
    },

    endGuest() {
      return exclusive(async () => {
        if (active?.mode !== 'guest') return
        const wanted = (await registry.meta.get('active'))?.value
        const back =
          profiles.find((p) => p.id === wanted) ??
          [...profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0]
        await openProfile(back.id)
      })
    },

    markPicked,
    noteAway() {
      awaySince ??= now()
    },
    noteBack() {
      if (awaySince !== null && now() - awaySince >= AWAY_LIMIT) {
        picked = false
        try {
          session?.removeItem(PICKED_KEY)
        } catch {
          /* private mode */
        }
        emit()
      }
      awaySince = null
    },

    async getPersistence() {
      await ensureStarted()
      const value = (await registry.meta.get('persistence'))?.value
      return value as { requested: boolean; granted: boolean } | undefined
    },
    async setPersistence(value) {
      await ensureStarted()
      await registry.meta.put({ key: 'persistence', value })
    },

    async exportProfile() {
      await ensureStarted()
      const open = snapshot.active
      const stores = await run((db) => readStores(db))
      return {
        app: 'dog-eared-tales',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        kind: 'profile',
        exportedAt: new Date(now()).toISOString(),
        name: open?.name ?? 'Guest',
        color: open?.color ?? 'slate',
        stores,
      }
    },

    replaceProfileWith(backup) {
      return exclusive(async () => {
        await run((db) => replaceStores(db, backup.stores))
      })
    },

    importAsNewProfile(backup) {
      return exclusive(async () => {
        profiles = await registry.profiles.orderBy('createdAt').toArray()
        if (profiles.length >= MAX_READING_PROFILES) {
          throw new ProfileError(
            'too-many',
            `Dog-Eared Tales keeps up to ${MAX_READING_PROFILES} profiles on one device.`,
          )
        }
        const name = fitName(
          backup.name,
          profiles.map((p) => p.name),
        )
        const color =
          backup.color && !profiles.some((p) => p.color === backup.color)
            ? backup.color
            : freeColor(profiles.map((p) => p.color))
        const profile = await insertProfile(name, color)
        try {
          await fillProfile(profile.id, backup.stores)
        } catch (error) {
          await registry.profiles.delete(profile.id)
          await deleteDatabase(dbNameOf(profile.id))
          throw error
        }
        profiles = [...profiles, profile]
        emit()
        tellOtherTabs()
        return profile
      })
    },

    clearOpenProfile() {
      return exclusive(async () => {
        await run((db) => clearStores(db))
      })
    },

    async exportAllProfiles() {
      await ensureStarted()
      profiles = await registry.profiles.orderBy('createdAt').toArray()
      const out: AllBackup['profiles'] = []
      for (const p of profiles) {
        if (active?.mode === 'profile' && active.id === p.id) {
          out.push({
            name: p.name,
            color: p.color,
            stores: await run((db) => readStores(db)),
          })
        } else {
          const db = new TwiceToldDB(dbNameOf(p.id))
          try {
            out.push({
              name: p.name,
              color: p.color,
              stores: await readStores(db),
            })
          } finally {
            db.close()
          }
        }
      }
      const index = profiles.findIndex(
        (p) => active?.mode === 'profile' && p.id === active.id,
      )
      return {
        app: 'dog-eared-tales',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        kind: 'all',
        exportedAt: new Date(now()).toISOString(),
        activeIndex: Math.max(0, index),
        profiles: out,
      }
    },

    replaceEverythingWith(backup) {
      return exclusive(() =>
        withLock(async () => {
          if (backup.profiles.length > MAX_READING_PROFILES) {
            throw new ProfileError(
              'too-many',
              'That backup has too many profiles.',
            )
          }
          // 1. Build the new profiles' databases first. Nothing existing is touched yet.
          const made: ReadingProfile[] = []
          const stamp = now()
          try {
            for (const [i, entry] of backup.profiles.entries()) {
              const id = randomId()
              await fillProfile(id, entry.stores)
              made.push({
                id,
                name: fitName(
                  entry.name,
                  made.map((m) => m.name),
                ),
                color: entry.color,
                createdAt: stamp + i,
                lastUsedAt: stamp + i,
              })
            }
          } catch (error) {
            await Promise.all(made.map((m) => deleteDatabase(dbNameOf(m.id))))
            throw error
          }
          // 2. Commit: one registry transaction.
          const open = made[Math.min(backup.activeIndex, made.length - 1)]
          const oldNames = (await registry.profiles.toArray()).map((p) =>
            dbNameOf(p.id),
          )
          await registry.transaction(
            'rw',
            [registry.profiles, registry.meta],
            async () => {
              await registry.profiles.clear()
              await registry.profiles.bulkPut(made)
              await registry.meta.put({ key: 'active', value: open.id })
            },
          )
          profiles = made
          // 3. Open the new active profile, then remove the old databases.
          const wasGuest = active?.mode === 'guest' ? active.dbName : null
          await swap({
            mode: 'profile',
            id: open.id,
            dbName: dbNameOf(open.id),
            db: new TwiceToldDB(dbNameOf(open.id)),
          })
          if (wasGuest) {
            session?.removeItem(GUEST_KEY)
            await deleteDatabase(wasGuest)
          }
          await Promise.all(oldNames.map(deleteDatabase))
          markPicked()
          tellOtherTabs()
        }),
      )
    },

    deleteEverything() {
      return exclusive(() =>
        withLock(async () => {
          await swap(null)
          const names = await allDatabases()
          await Promise.all(
            names
              .filter(
                (n) =>
                  n.startsWith(profilePrefix) ||
                  n.startsWith(guestPrefix) ||
                  n === legacyName,
              )
              .map(deleteDatabase),
          )
          session?.removeItem(GUEST_KEY)
          await registry.transaction(
            'rw',
            [registry.profiles, registry.meta],
            async () => {
              await registry.profiles.clear()
              await registry.meta.clear()
            },
          )
          const me = await insertProfile('Me', 'rust')
          await registry.meta.put({ key: 'active', value: me.id })
          profiles = [me]
          await swap({
            mode: 'profile',
            id: me.id,
            dbName: dbNameOf(me.id),
            db: new TwiceToldDB(dbNameOf(me.id)),
          })
          markPicked()
          tellOtherTabs()
        }),
      )
    },

    forward<S extends object>(make: (db: TwiceToldDB) => S): S {
      return new Proxy({} as S, {
        get(_target, property) {
          if (typeof property !== 'string' || property === 'then')
            return undefined
          return (...args: unknown[]) =>
            run((db) => {
              const method = (make(db) as Record<string, unknown>)[property]
              return (method as (...a: unknown[]) => unknown)(...args)
            })
        },
      })
    },

    close() {
      closed = true
      channel?.close()
      active?.db.close()
      registry.close()
      listeners.clear()
    },
  }

  return manager
}

function safeSession(): SessionStorageLike | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}
