// The public face of the storage layer. Export interfaces and ready-made stores
// only. Never export Dexie or the database object from here.
import { TwiceToldDB } from './db'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'

export * from './types'

const db = new TwiceToldDB()

export const profileStore = createProfileStore(db)
export const eventLog = createEventLog(db)
export const libraryStore = createLibraryStore(db)
export const progressStore = createProgressStore(db)
export const highlightStore = createHighlightStore(db)
export const settingsStore = createSettingsStore(db)
