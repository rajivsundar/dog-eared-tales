import Dexie, { type EntityTable } from 'dexie'
import type {
  Highlight,
  Profile,
  Progress,
  ReaderEvent,
  SavedWork,
  Settings,
} from './types'

export const DB_NAME = 'dog-eared-tales'

/**
 * The only place that defines the IndexedDB schema.
 * To change the schema later, add a new `this.version(n + 1).stores(...)`
 * (with `.upgrade(...)` if data must be converted) and leave older versions as they are.
 */
export class TwiceToldDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  events!: EntityTable<ReaderEvent, 'id'>
  library!: EntityTable<SavedWork, 'workId'>
  progress!: EntityTable<Progress, 'workId'>
  highlights!: EntityTable<Highlight, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      events: 'id, workId, at',
      library: 'workId, addedAt',
      progress: 'workId, updatedAt',
      highlights: 'id, workId',
      settings: 'id',
    })
  }
}
