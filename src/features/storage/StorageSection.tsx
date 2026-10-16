import { useEffect, useState } from 'react'
import { loadCatalog } from '../../catalog'
import { cachedTextPaths } from '../../pwa/textCache'
import {
  type StorageStatus,
  formatBytes,
  readStorageStatus,
} from './persistence'

interface Info {
  status: StorageStatus
  savedStories: number
}

/** Settings → Storage: is the data protected, how much space it uses, and how many stories are saved offline. */
export function StorageSection() {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [status, paths, catalog] = await Promise.all([
        readStorageStatus(),
        cachedTextPaths(),
        loadCatalog().catch(() => []),
      ])
      // Several stories can share one book file, so count stories, not files.
      const savedStories = catalog.filter((e) => paths.has(e.textUrl)).length
      if (!cancelled) setInfo({ status, savedStories })
    })().catch((error: unknown) => console.debug(error))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="storage-title" className="mt-10">
      <h2 id="storage-title" className="font-serif text-2xl font-bold">
        Storage
      </h2>
      {!info ? (
        <p className="mt-2 text-muted">Loading…</p>
      ) : (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
          <dt>Protected from automatic clearing</dt>
          <dd data-testid="persisted" className="font-semibold">
            {info.status.persisted === undefined
              ? 'Unknown'
              : info.status.persisted
                ? 'Yes'
                : 'No'}
          </dd>
          <dt>Space used</dt>
          <dd data-testid="space-used" className="font-semibold">
            {info.status.usage === undefined
              ? 'Unknown'
              : formatBytes(info.status.usage)}
          </dd>
          <dt>Stories saved for offline</dt>
          <dd data-testid="saved-offline" className="font-semibold">
            {info.savedStories}
          </dd>
        </dl>
      )}
    </section>
  )
}
