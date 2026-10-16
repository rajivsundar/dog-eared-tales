import type { EventLog, LibraryStore, SavedWork } from '../../stores'

export interface DogEarDeps {
  events: Pick<EventLog, 'append'>
  library: LibraryStore
}

/** Dog-ear: log it and keep the whole work in the library. */
export async function addDogEar(
  deps: DogEarDeps,
  workId: string,
): Promise<void> {
  await deps.events.append({ workId, type: 'save' })
  await deps.library.save(workId)
}

/** Un-dog-ear: log it and take the work out of the library. Returns what was removed, for Undo. */
export async function removeDogEar(
  deps: DogEarDeps,
  workId: string,
): Promise<SavedWork | undefined> {
  const saved = await deps.library.get(workId)
  await deps.events.append({ workId, type: 'unsave' })
  await deps.library.remove(workId)
  return saved
}

/** Undo an un-dog-ear: put the work back as it was and log the undo. */
export async function restoreDogEar(
  deps: DogEarDeps,
  saved: SavedWork,
): Promise<void> {
  await deps.library.save(saved.workId, {
    shelf: saved.shelf,
    offline: saved.offline,
    addedAt: saved.addedAt,
  })
  await deps.events.append({
    workId: saved.workId,
    type: 'undo',
    reason: 'unsave',
  })
}
