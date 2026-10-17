// The public face of the storage layer. Export interfaces and ready-made stores
// only. Never export Dexie or the database object from here.
import type { DataStore } from './backup'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import { createProfileManager } from './profileManager'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'

export * from './types'
export { BACKUP_SCHEMA_VERSION, BackupError, parseBackup } from './backup'
export type {
  AllBackup,
  BackupFile,
  BackupProblem,
  DataStore,
  ProfileBackup,
} from './backup'
export { ProfileError } from './profileManager'
export type {
  ProfileErrorCode,
  ProfileManager,
  ProfileSnapshot,
} from './profileManager'

/** Knows which reading profile is open. Every store below works on it. */
export const profileManager = createProfileManager()

export const profileStore = profileManager.forward(createProfileStore)
export const eventLog = profileManager.forward(createEventLog)
export const libraryStore = profileManager.forward(createLibraryStore)
export const progressStore = profileManager.forward(createProgressStore)
export const highlightStore = profileManager.forward(createHighlightStore)
export const settingsStore = profileManager.forward(createSettingsStore)

/** The open profile's data: export, replace and wipe. */
export const dataStore: DataStore = {
  exportAll: () => profileManager.exportProfile(),
  importAll: (backup) => profileManager.replaceProfileWith(backup),
  deleteAll: () => profileManager.clearOpenProfile(),
}
