import type { TwiceToldDB } from './db'
import type { ProgressStore } from './types'

export function createProgressStore(db: TwiceToldDB): ProgressStore {
  return {
    get: (workId) => db.progress.get(workId),
    async set(progress) {
      const saved = { ...progress, updatedAt: Date.now() }
      await db.progress.put(saved)
      return saved
    },
    list: () => db.progress.orderBy('updatedAt').reverse().toArray(),
    async remove(workId) {
      await db.progress.delete(workId)
    },
  }
}
