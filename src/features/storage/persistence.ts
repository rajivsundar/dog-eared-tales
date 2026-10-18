import type { EventLog, ProfileManager } from '../../stores'

export interface PersistenceDeps {
  /** Where the answer is kept: one answer for the whole device, not one per profile. */
  persistence: Pick<ProfileManager, 'getPersistence' | 'setPersistence'>
  events: Pick<EventLog, 'list'>
  /** The guest never asks: nothing the guest does is kept. */
  isGuest?: () => boolean
  storage?: Pick<StorageManager, 'persist'>
}

/** The usual dependencies, from the profile manager and the open profile's event log. */
export function persistenceDeps(
  manager: Pick<
    ProfileManager,
    'getPersistence' | 'setPersistence' | 'current'
  >,
  events: Pick<EventLog, 'list'>,
): PersistenceDeps {
  return {
    persistence: manager,
    events,
    isGuest: () => manager.current().mode === 'guest',
  }
}

/** The request that is running right now, so overlapping triggers share it. */
let running: Promise<void> | null = null

/**
 * Asks the browser to protect Dog-Eared Tales's data from automatic clearing (navigator.storage.persist()).
 * It does so once, and only after the reader's first Dog-ear or first finished work. The answer is
 * kept for the whole device, so later calls (and later visits) never ask again.
 */
export function requestPersistenceIfEarned(
  deps: PersistenceDeps,
): Promise<void> {
  if (running) return running
  running = (async () => {
    if (deps.isGuest?.()) return
    const storage = deps.storage ?? globalThis.navigator?.storage
    if (!storage?.persist) return
    if ((await deps.persistence.getPersistence())?.requested) return
    const events = await deps.events.list()
    if (!events.some((e) => e.type === 'save' || e.type === 'finished')) return
    // Write "asked" first, so a second tab or a quick second trigger cannot ask again.
    await deps.persistence.setPersistence({ requested: true, granted: false })
    const granted = await storage.persist()
    await deps.persistence.setPersistence({ requested: true, granted })
  })()
    .catch((error: unknown) =>
      console.debug('could not ask for persistence', error),
    )
    .finally(() => {
      running = null
    })
  return running
}

export interface StorageStatus {
  /** Protected from automatic clearing, or undefined if the browser will not say. */
  persisted: boolean | undefined
  /** Bytes used by this app, or undefined if the browser will not say. */
  usage: number | undefined
}

/** What Settings → Storage shows. */
export async function readStorageStatus(
  storage:
    Pick<StorageManager, 'persisted' | 'estimate'> | undefined = globalThis
    .navigator?.storage,
): Promise<StorageStatus> {
  let persisted: boolean | undefined
  let usage: number | undefined
  try {
    persisted = await storage?.persisted?.()
  } catch {
    persisted = undefined
  }
  try {
    usage = (await storage?.estimate?.())?.usage
  } catch {
    usage = undefined
  }
  return { persisted, usage }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
