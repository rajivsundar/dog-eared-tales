import type { TwiceToldDB } from './db'
import type {
  Highlight,
  Profile,
  ProfileColor,
  Progress,
  ReaderEvent,
  SavedWork,
  Settings,
} from './types'
import { MAX_READING_PROFILES, PROFILE_COLORS } from './types'

/** The version of the backup file format. Raise it when the file's shape changes. */
export const BACKUP_SCHEMA_VERSION = 2

/** Every store of one reading profile, as plain lists of records. */
export interface BackupStores {
  profile: Profile[]
  events: ReaderEvent[]
  library: SavedWork[]
  progress: Progress[]
  highlights: Highlight[]
  settings: Settings[]
}

/** One reading profile's backup. Version 1 files (before profiles) read as this, with no name. */
export interface ProfileBackup {
  app: 'twice-told'
  schemaVersion: number
  kind: 'profile'
  /** When the backup was made, as an ISO date and time. */
  exportedAt: string
  /** Missing in version 1 files. */
  name?: string
  color?: ProfileColor
  stores: BackupStores
}

/** Every reading profile on the device. */
export interface AllBackup {
  app: 'twice-told'
  schemaVersion: number
  kind: 'all'
  exportedAt: string
  /** Position (in `profiles`) of the profile that was open. */
  activeIndex: number
  profiles: { name: string; color: ProfileColor; stores: BackupStores }[]
}

export type BackupFile = ProfileBackup | AllBackup

export type BackupProblem =
  'not-json' | 'not-a-backup' | 'newer-version' | 'too-many-profiles'

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

/** The active reading profile's data: export, replace and wipe. */
export interface DataStore {
  /** This profile, as one backup file. */
  exportAll(): Promise<ProfileBackup>
  /** Replaces this profile's data with the backup. All or nothing. */
  importAll(backup: ProfileBackup): Promise<void>
  /** Wipes this profile's data. */
  deleteAll(): Promise<void>
}

export const STORE_NAMES = [
  'profile',
  'events',
  'library',
  'progress',
  'highlights',
  'settings',
] as const

export const emptyStores = (): BackupStores => ({
  profile: [],
  events: [],
  library: [],
  progress: [],
  highlights: [],
  settings: [],
})

const isColor = (value: unknown): value is ProfileColor =>
  PROFILE_COLORS.some((c) => c.id === value)

const incomplete = () =>
  new BackupError(
    'not-a-backup',
    'This backup is incomplete, so it was not restored.',
  )

function checkStores(stores: unknown): BackupStores {
  const found = stores as Partial<BackupStores> | null
  if (!found || typeof found !== 'object') throw incomplete()
  for (const name of STORE_NAMES) {
    if (!Array.isArray(found[name])) throw incomplete()
  }
  return found as BackupStores
}

/**
 * Reads a backup file's text. Refuses anything that is not a Twice Told backup, or is from a newer
 * version. A version 1 file (one reader, no name) comes back as a one-profile backup.
 */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('not-json', 'This file is not a Twice Told backup.')
  }
  const file = data as Record<string, unknown> | null
  if (
    !file ||
    typeof file !== 'object' ||
    file.app !== 'twice-told' ||
    typeof file.schemaVersion !== 'number'
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
  const exportedAt =
    typeof file.exportedAt === 'string'
      ? file.exportedAt
      : new Date(0).toISOString()
  if (file.kind === 'all') {
    if (!Array.isArray(file.profiles) || file.profiles.length === 0) {
      throw incomplete()
    }
    if (file.profiles.length > MAX_READING_PROFILES) {
      throw new BackupError(
        'too-many-profiles',
        `This backup has more than ${MAX_READING_PROFILES} profiles, which Twice Told cannot keep.`,
      )
    }
    const profiles = (file.profiles as Record<string, unknown>[]).map((p) => {
      if (typeof p?.name !== 'string' || !p.name || !isColor(p.color)) {
        throw incomplete()
      }
      return { name: p.name, color: p.color, stores: checkStores(p.stores) }
    })
    const index = Number(file.activeIndex)
    return {
      app: 'twice-told',
      schemaVersion: file.schemaVersion,
      kind: 'all',
      exportedAt,
      activeIndex: Number.isInteger(index) && profiles[index] ? index : 0,
      profiles,
    }
  }
  const backup: ProfileBackup = {
    app: 'twice-told',
    schemaVersion: file.schemaVersion,
    kind: 'profile',
    exportedAt,
    stores: checkStores(file.stores),
  }
  if (typeof file.name === 'string' && file.name.trim()) {
    backup.name = file.name
  }
  if (isColor(file.color)) backup.color = file.color
  return backup
}

/** Everything in one profile's database. */
export async function readStores(db: TwiceToldDB): Promise<BackupStores> {
  const [profile, events, library, progress, highlights, settings] =
    await Promise.all([
      db.profile.toArray(),
      db.events.orderBy('at').toArray(),
      db.library.toArray(),
      db.progress.toArray(),
      db.highlights.toArray(),
      db.settings.toArray(),
    ])
  return { profile, events, library, progress, highlights, settings }
}

const tables = (db: TwiceToldDB) => STORE_NAMES.map((name) => db[name])

/** Replaces everything in the database with the stores. All or nothing. */
export async function replaceStores(
  db: TwiceToldDB,
  stores: BackupStores,
): Promise<void> {
  await db.transaction('rw', tables(db), async () => {
    await Promise.all(tables(db).map((table) => table.clear()))
    await db.profile.bulkPut(stores.profile)
    await db.events.bulkPut(stores.events)
    await db.library.bulkPut(stores.library)
    await db.progress.bulkPut(stores.progress)
    await db.highlights.bulkPut(stores.highlights)
    await db.settings.bulkPut(stores.settings)
  })
}

/** Empties every store of the database. */
export async function clearStores(db: TwiceToldDB): Promise<void> {
  await db.transaction('rw', tables(db), () =>
    Promise.all(tables(db).map((table) => table.clear())),
  )
}

/** The primary key of each store, to compare two copies record by record. */
const KEY: Record<(typeof STORE_NAMES)[number], string> = {
  profile: 'id',
  events: 'id',
  library: 'workId',
  progress: 'workId',
  highlights: 'id',
  settings: 'id',
}

/** A key-order-independent text for a record. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** The first difference between two copies of the same data, or null if every record matches. */
export function firstDifference(
  a: BackupStores,
  b: BackupStores,
): string | null {
  for (const name of STORE_NAMES) {
    const key = KEY[name]
    const byKey = (list: unknown[]) =>
      new Map(
        (list as Record<string, unknown>[]).map((r) => [String(r[key]), r]),
      )
    const left = byKey(a[name])
    const right = byKey(b[name])
    if (left.size !== a[name].length || right.size !== b[name].length) {
      return `${name}: duplicate keys`
    }
    if (left.size !== right.size) {
      return `${name}: ${left.size} records became ${right.size}`
    }
    for (const [id, record] of left) {
      const other = right.get(id)
      if (!other || canonical(record) !== canonical(other)) {
        return `${name}: record ${id} differs`
      }
    }
  }
  return null
}
