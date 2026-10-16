import type { EventLog, SettingsStore } from '../../stores'

export interface PersistenceDeps {
  settings: Pick<SettingsStore, 'get' | 'update'>
  events: Pick<EventLog, 'list'>
  storage?: Pick<StorageManager, 'persist'>
}

/** The request that is running right now, so overlapping triggers share it. */
let running: Promise<void> | null = null

/**
 * Asks the browser to protect Twice Told's data from automatic clearing (navigator.storage.persist()).
 * It does so once, and only after the reader's first Dog-ear or first finished work. The answer is
 * kept in the settings, so later calls (and later visits) never ask again.
 */
export function requestPersistenceIfEarned(
  deps: PersistenceDeps,
): Promise<void> {
  if (running) return running
  running = (async () => {
    const storage = deps.storage ?? globalThis.navigator?.storage
    if (!storage?.persist) return
    const settings = await deps.settings.get()
    if (settings.persistence?.requested) return
    const events = await deps.events.list()
    if (!events.some((e) => e.type === 'save' || e.type === 'finished')) return
    // Write "asked" first, so a second tab or a quick second trigger cannot ask again.
    await deps.settings.update({
      persistence: { requested: true, granted: false },
    })
    const granted = await storage.persist()
    await deps.settings.update({ persistence: { requested: true, granted } })
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
