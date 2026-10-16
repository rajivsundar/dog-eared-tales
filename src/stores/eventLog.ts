import type { TwiceToldDB } from './db'
import type { EventLog, ReaderEvent } from './types'

export function createEventLog(db: TwiceToldDB): EventLog {
  return {
    async append(event) {
      const saved: ReaderEvent = {
        ...event,
        id: crypto.randomUUID(),
        at: event.at ?? Date.now(),
      }
      await db.events.add(saved)
      return saved
    },
    list: () => db.events.orderBy('at').toArray(),
    listForWork: (workId) =>
      db.events.where('workId').equals(workId).sortBy('at'),
  }
}
