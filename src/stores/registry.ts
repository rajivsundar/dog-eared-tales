import Dexie, { type EntityTable } from 'dexie'
import type { ReadingProfile } from './types'

export const REGISTRY_NAME = 'twice-told-profiles'

/** A small named value kept next to the profile list. */
export interface MetaRecord {
  key: string
  value: unknown
}

/**
 * The list of reading profiles on this device, and a few facts that belong to the device rather
 * than to one profile: which profile is open, and whether we have asked the browser to protect
 * the data from automatic clearing. Each profile's reading lives in its own database (see db.ts).
 */
export class RegistryDB extends Dexie {
  profiles!: EntityTable<ReadingProfile, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor(name: string = REGISTRY_NAME) {
    super(name)
    this.version(1).stores({
      profiles: 'id, createdAt',
      meta: 'key',
    })
  }
}
