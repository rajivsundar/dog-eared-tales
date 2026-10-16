import type { TwiceToldDB } from './db'
import type { HighlightStore } from './types'

export function createHighlightStore(db: TwiceToldDB): HighlightStore {
  return {
    async add(highlight) {
      const saved = { ...highlight, id: crypto.randomUUID() }
      await db.highlights.add(saved)
      return saved
    },
    listForWork: (workId) =>
      db.highlights.where('workId').equals(workId).toArray(),
    async remove(id) {
      await db.highlights.delete(id)
    },
  }
}
