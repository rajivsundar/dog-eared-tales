import type { TwiceToldDB } from './db'
import type {
  Highlight,
  Profile,
  Progress,
  ReaderEvent,
  SavedWork,
  Settings,
} from './types'

/** The version of the backup file format. Raise it when the file's shape changes. */
export const BACKUP_SCHEMA_VERSION = 1

export interface BackupFile {
  app: 'twice-told'
  schemaVersion: number
  /** When the backup was made, as an ISO date and time. */
  exportedAt: string
  /** Every store, as plain lists of records. */
  stores: {
    profile: Profile[]
    events: ReaderEvent[]
    library: SavedWork[]
    progress: Progress[]
    highlights: Highlight[]
    settings: Settings[]
  }
}

export type BackupProblem = 'not-json' | 'not-a-backup' | 'newer-version'

/** Why a backup file was refused. */
export class BackupError extends Error {
  constructor(
    readonly problem: BackupProblem,
    message: string,
  ) {
    super(message)
    this.name = 'BackupError'
  }
}

export interface DataStore {
  /** Everything on this device, as one backup. */
  exportAll(): Promise<BackupFile>
  /** Replaces everything on this device with the backup. All or nothing. */
  importAll(backup: BackupFile): Promise<void>
  /** Wipes every store. */
  deleteAll(): Promise<void>
}

const STORE_NAMES = [
  'profile',
  'events',
  'library',
  'progress',
  'highlights',
  'settings',
] as const

/** Reads a backup file's text. Refuses anything that is not a Twice Told backup, or is from a newer version. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('not-json', 'This file is not a Twice Told backup.')
  }
  const file = data as Partial<BackupFile> | null
  if (
    !file ||
    typeof file !== 'object' ||
    file.app !== 'twice-told' ||
    typeof file.schemaVersion !== 'number' ||
    !file.stores ||
    typeof file.stores !== 'object'
  ) {
    throw new BackupError(
      'not-a-backup',
      'This file is not a Twice Told backup.',
    )
  }
  if (file.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      'newer-version',
      `This backup was made by a newer version of Twice Told (format ${file.schemaVersion}). Update the app, then try again.`,
    )
  }
  for (const name of STORE_NAMES) {
    if (!Array.isArray(file.stores[name])) {
      throw new BackupError(
        'not-a-backup',
        'This backup is incomplete, so it was not restored.',
      )
    }
  }
  return file as BackupFile
}

export function createDataStore(db: TwiceToldDB): DataStore {
  const tables = () => STORE_NAMES.map((name) => db[name])
  return {
    async exportAll() {
      const [profile, events, library, progress, highlights, settings] =
        await Promise.all([
          db.profile.toArray(),
          db.events.orderBy('at').toArray(),
          db.library.toArray(),
          db.progress.toArray(),
          db.highlights.toArray(),
          db.settings.toArray(),
        ])
      return {
        app: 'twice-told',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        stores: { profile, events, library, progress, highlights, settings },
      }
    },

    async importAll(backup) {
      if (backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
        throw new BackupError(
          'newer-version',
          'This backup was made by a newer version of Twice Told.',
        )
      }
      await db.transaction('rw', tables(), async () => {
        await Promise.all(tables().map((table) => table.clear()))
        await db.profile.bulkPut(backup.stores.profile)
        await db.events.bulkPut(backup.stores.events)
        await db.library.bulkPut(backup.stores.library)
        await db.progress.bulkPut(backup.stores.progress)
        await db.highlights.bulkPut(backup.stores.highlights)
        await db.settings.bulkPut(backup.stores.settings)
      })
    },

    async deleteAll() {
      await db.transaction('rw', tables(), () =>
        Promise.all(tables().map((table) => table.clear())),
      )
    },
  }
}
