// The public face of the storage layer. Export interfaces and ready-made stores
// only. Never export Dexie or the database object from here.
import { createDataStore } from './backup'
import { TwiceToldDB } from './db'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'

export * from './types'
export { BACKUP_SCHEMA_VERSION, BackupError, parseBackup } from './backup'
export type { BackupFile, BackupProblem, DataStore } from './backup'

const db = new TwiceToldDB()

export const profileStore = createProfileStore(db)
export const eventLog = createEventLog(db)
export const libraryStore = createLibraryStore(db)
export const progressStore = createProgressStore(db)
export const highlightStore = createHighlightStore(db)
export const settingsStore = createSettingsStore(db)
export const dataStore = createDataStore(db)
