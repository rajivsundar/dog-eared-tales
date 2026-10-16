/**
 * The book-text cache. The service worker fills it as books are opened (cache-first, see
 * vite.config.ts); this module also fills it ahead of time for the works the reader is likely to open.
 */

export const TEXTS_CACHE = 'twice-told-texts'
/** Leave the texts alone if less than this much storage is free. */
export const MIN_FREE_BYTES = 50 * 1024 * 1024

export interface TextCacheDeps {
  caches?: CacheStorage
  fetch?: typeof fetch
  storage?: Pick<StorageManager, 'estimate'>
  isOnline?: () => boolean
}

export type AutoCacheStatus = 'ok' | 'offline' | 'low-space' | 'unsupported'

export interface AutoCacheResult {
  status: AutoCacheStatus
  /** Files fetched and stored this time. */
  cached: string[]
  /** Files that could not be fetched. */
  failed: string[]
}

const listeners = new Set<() => void>()
/** Called after files were added to the cache, so the screen can show the new offline icons. */
export function onTextCacheChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

type Outcome = 'cached' | 'present' | 'failed'

/**
 * What this session has already done, for one Cache Storage: files stored, and requests still
 * running. Overlapping runs (such as the shortlist effect running twice) share one request per
 * file, so each book is fetched at most once per session.
 */
interface Session {
  saved: Set<string>
  pending: Map<string, Promise<Outcome>>
}
const sessions = new WeakMap<object, Session>()
function sessionFor(cacheStorage: CacheStorage): Session {
  let session = sessions.get(cacheStorage)
  if (!session) {
    session = { saved: new Set(), pending: new Map() }
    sessions.set(cacheStorage, session)
  }
  return session
}

/** Fetches one file unless it is already stored or already being fetched, and stores it. */
function fetchOnce(
  path: string,
  cache: Cache,
  fetchFn: typeof fetch,
  session: Session,
): Promise<Outcome> {
  const running = session.pending.get(path)
  if (running) return running
  const run = (async (): Promise<Outcome> => {
    // Look in the texts cache first: a file already there is never fetched again.
    if (session.saved.has(path) || (await cache.match(path))) {
      session.saved.add(path)
      return 'present'
    }
    const response = await fetchFn(path)
    if (response.ok && response.status === 200) {
      await cache.put(path, response)
      session.saved.add(path)
      return 'cached'
    }
    return 'failed'
  })()
    .catch((): Outcome => 'failed')
    .finally(() => session.pending.delete(path))
  session.pending.set(path, run)
  return run
}

function pathOf(url: string): string {
  return new URL(url, 'http://localhost').pathname
}

/** The paths (such as "/texts/pg-35.epub") of the books stored for offline reading. */
export async function cachedTextPaths(
  cacheStorage: CacheStorage | undefined = globalThis.caches,
): Promise<Set<string>> {
  if (!cacheStorage) return new Set()
  try {
    const cache = await cacheStorage.open(TEXTS_CACHE)
    return new Set((await cache.keys()).map((request) => pathOf(request.url)))
  } catch {
    return new Set()
  }
}

/** Free storage in bytes, or undefined if the browser will not say. */
export async function freeBytes(
  storage: Pick<StorageManager, 'estimate'> | undefined,
): Promise<number | undefined> {
  if (!storage?.estimate) return undefined
  try {
    const { quota, usage } = await storage.estimate()
    return quota === undefined ? undefined : quota - (usage ?? 0)
  } catch {
    return undefined
  }
}

/**
 * Quietly fetches each book file once and stores it. Does nothing offline, when the browser has
 * no Cache Storage, or when less than 50 MB is free. Never throws.
 */
export async function autoCacheTexts(
  urls: string[],
  deps: TextCacheDeps = {},
): Promise<AutoCacheResult> {
  const cacheStorage = deps.caches ?? globalThis.caches
  const fetchFn = deps.fetch ?? globalThis.fetch?.bind(globalThis)
  const isOnline = deps.isOnline ?? (() => globalThis.navigator?.onLine ?? true)
  const result: AutoCacheResult = { status: 'ok', cached: [], failed: [] }

  if (!cacheStorage || !fetchFn) return { ...result, status: 'unsupported' }
  if (!isOnline()) return { ...result, status: 'offline' }

  try {
    const have = await cachedTextPaths(cacheStorage)
    // Several works share one EPUB: each file is fetched once.
    const session = sessionFor(cacheStorage)
    const wanted = [...new Set(urls.map(pathOf))].filter(
      (path) => !have.has(path) && !session.saved.has(path),
    )
    if (wanted.length === 0) return result

    const free = await freeBytes(deps.storage ?? globalThis.navigator?.storage)
    if (free !== undefined && free < MIN_FREE_BYTES) {
      return { ...result, status: 'low-space' }
    }

    const cache = await cacheStorage.open(TEXTS_CACHE)
    for (const path of wanted) {
      if (!isOnline()) {
        result.status = 'offline'
        break
      }
      const outcome = await fetchOnce(path, cache, fetchFn, session)
      if (outcome === 'cached') result.cached.push(path)
      else if (outcome === 'failed') result.failed.push(path)
    }
  } catch (error) {
    console.debug('could not save books for offline', error)
  }
  if (result.cached.length > 0) listeners.forEach((listener) => listener())
  return result
}

/** Deletes every stored book (Delete all my data) and forgets what this session had saved. */
export async function clearTextCache(
  cacheStorage: CacheStorage | undefined = globalThis.caches,
): Promise<void> {
  if (!cacheStorage) return
  try {
    await cacheStorage.delete(TEXTS_CACHE)
  } catch (error) {
    console.debug('could not clear the saved books', error)
  }
  sessions.delete(cacheStorage)
  listeners.forEach((listener) => listener())
}
