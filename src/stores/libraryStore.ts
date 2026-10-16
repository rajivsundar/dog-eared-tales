import type { TwiceToldDB } from './db'
import type { LibraryStore, SavedWork } from './types'

export function createLibraryStore(db: TwiceToldDB): LibraryStore {
  return {
    get: (workId) => db.library.get(workId),
    list: () => db.library.orderBy('addedAt').reverse().toArray(),
    async save(workId, options = {}) {
      const existing = await db.library.get(workId)
      const item: SavedWork = {
        workId,
        shelf: options.shelf ?? existing?.shelf ?? 'default',
        offline: options.offline ?? existing?.offline ?? false,
        addedAt: existing?.addedAt ?? options.addedAt ?? Date.now(),
      }
      await db.library.put(item)
      return item
    },
    async remove(workId) {
      await db.library.delete(workId)
    },
  }
}
