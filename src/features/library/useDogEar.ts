import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type SavedWork,
  eventLog,
  libraryStore,
  profileManager,
} from '../../stores'
import {
  persistenceDeps,
  requestPersistenceIfEarned,
} from '../storage/persistence'
import { addDogEar, removeDogEar, restoreDogEar } from './dogEar'

export interface DogEarRemoval {
  key: number
  saved: SavedWork
}

const deps = { events: eventLog, library: libraryStore }

/**
 * Which works are dog-eared, with a toggle that records the events and keeps the library in step.
 * After an un-dog-ear, `removed` holds what to show in the "Removed · Undo" message.
 */
export function useDogEar() {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
  const [removed, setRemoved] = useState<DogEarRemoval | null>(null)
  // Writes run one after another, so a quick Undo never overtakes the removal.
  const writes = useRef<Promise<unknown>>(Promise.resolve())

  const load = useCallback(async (): Promise<void> => {
    const saved = await libraryStore.list()
    setIds(new Set(saved.map((s) => s.workId)))
  }, [])

  useEffect(() => {
    let cancelled = false
    libraryStore
      .list()
      .then((saved) => {
        if (!cancelled) setIds(new Set(saved.map((s) => s.workId)))
      })
      .catch((error: unknown) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [])

  const enqueue = useCallback(
    (task: () => Promise<unknown>): void => {
      writes.current = writes.current.then(task).catch((error: unknown) => {
        console.error(error)
        load().catch(() => {})
      })
    },
    [load],
  )

  const toggle = (workId: string): void => {
    if (ids.has(workId)) {
      setIds((prev) => {
        const next = new Set(prev)
        next.delete(workId)
        return next
      })
      enqueue(async () => {
        const saved = await removeDogEar(deps, workId)
        if (saved) setRemoved({ key: Date.now(), saved })
      })
    } else {
      setIds((prev) => new Set(prev).add(workId))
      setRemoved(null)
      enqueue(async () => {
        await addDogEar(deps, workId)
        // The first Dog-ear asks the browser to protect the data (once).
        await requestPersistenceIfEarned(
          persistenceDeps(profileManager, eventLog),
        )
      })
    }
  }

  const undo = (): void => {
    if (!removed) return
    const { saved } = removed
    setRemoved(null)
    setIds((prev) => new Set(prev).add(saved.workId))
    enqueue(() => restoreDogEar(deps, saved))
  }

  return {
    ids,
    toggle,
    removed,
    undo,
    dismiss: () => setRemoved(null),
  }
}
