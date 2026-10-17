import { useEffect, useState } from 'react'
import { loadCatalog } from '../../catalog'
import {
  cachedTextPaths,
  autoCacheTexts,
  onTextCacheChange,
} from '../../pwa/textCache'
import {
  eventLog,
  libraryStore,
  profileManager,
  progressStore,
  settingsStore,
} from '../../stores'
import { localDay } from '../shortlist/dailyShortlist'
import { offlineTargets } from './offlineTargets'

/** Which books are stored for offline reading, as paths such as "/texts/pg-35.epub". */
export function useCachedTexts(): ReadonlySet<string> {
  const [paths, setPaths] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      void cachedTextPaths().then((found) => {
        if (!cancelled) setPaths(found)
      })
    }
    refresh()
    const stop = onTextCacheChange(refresh)
    return () => {
      cancelled = true
      stop()
    }
  }, [])
  return paths
}

/** Works out what to keep and quietly stores it. Does nothing offline, or for the guest. */
export async function syncOfflineTexts(now: Date = new Date()): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  // A guest keeps nothing, so nothing is stored for them.
  if (profileManager.current().mode === 'guest') return
  try {
    const [catalog, settings, library, progress, events] = await Promise.all([
      loadCatalog(),
      settingsStore.get(),
      libraryStore.list(),
      progressStore.list(),
      eventLog.list(),
    ])
    const urls = offlineTargets({
      catalog,
      shortlist: settings.shortlist,
      longList: settings.longList,
      library,
      progress,
      events,
      today: localDay(now),
    })
    await autoCacheTexts(urls)
  } catch (error) {
    console.debug('could not save books for offline', error)
  }
}

/**
 * Keeps the offline books in step: runs whenever `trigger` changes (the lists, Dog-ears or
 * Reading changed) and whenever the browser comes back online.
 */
export function useAutoCache(trigger: string): void {
  useEffect(() => {
    void syncOfflineTexts()
  }, [trigger])
  useEffect(() => {
    const onOnline = (): void => void syncOfflineTexts()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])
}
