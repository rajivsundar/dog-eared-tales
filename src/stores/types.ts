// Record shapes and store interfaces. Other code imports only from "src/stores"
// (see index.ts) and uses these interfaces, never Dexie.
// Times are milliseconds since 1970 (Date.now()). Locators are text strings
// produced by the reader engine.

export interface FacetBelief {
  success: number
  failure: number
}

export interface Profile {
  id: string
  tasteVector: number[]
  /** Keyed by facet, for example "genre:horror". */
  facetBeliefs: Record<string, FacetBelief>
  ladderLevel: number
  wordsPerMinute: number
  /** Profile format version, so a profile can be rebuilt after a change. */
  version: number
}

export type ReaderEventType =
  | 'love'
  | 'ok'
  | 'notForMe'
  | 'open'
  | 'progress'
  | 'shown'
  | 'tap'
  | 'undo'
  | 'reset'
  | 'onboard'
  | 'session'
  | 'finished'
  | 'stopped'
  | 'abandoned'
  | 'save'
  | 'unsave'

export interface ReaderEvent {
  id: string
  workId: string
  type: ReaderEventType
  value?: number
  reason?: string
  at: number
}

export type NewReaderEvent = Omit<ReaderEvent, 'id' | 'at'> & { at?: number }

/** A work kept for later. Readers see this as Dog-eared. */
export interface SavedWork {
  workId: string
  shelf: string
  addedAt: number
  offline: boolean
}

export interface Progress {
  workId: string
  locator: string
  percent: number
  secondsRead: number
  updatedAt: number
}

export interface Highlight {
  id: string
  workId: string
  locator: string
  color: string
  note?: string
}

export const FONTS = [
  'literata',
  'atkinson',
  'opendyslexic',
  'systemSerif',
] as const
export type FontChoice = (typeof FONTS)[number]

/** "system" means Paper in light mode and Night in dark mode. */
export const THEMES = ['system', 'paper', 'sepia', 'night', 'black'] as const
export type ThemeChoice = (typeof THEMES)[number]

export const MIN_TEXT_SIZE = 1
export const MAX_TEXT_SIZE = 10

/** Today's Shortlist, kept so every load on the same local day shows the same picks. */
export interface DailyShortlist {
  /** Local date, "YYYY-MM-DD". */
  date: string
  picks: Array<{ workId: string; reason: string }>
  /** Works kept off today's list and its replacements (taste cards answered Not for me). */
  avoid?: string[]
}

export interface Settings {
  id: string
  theme: ThemeChoice
  font: FontChoice
  /** A step from 1 to 10 (not pixels). */
  textSize: number
  mix: string
  aiPrefs: Record<string, unknown>
  contentFilters: Record<string, unknown>
  shortlist?: DailyShortlist
  /** Today's Your Long List, kept like the shortlist. */
  longList?: DailyShortlist
  /** Whether we have asked the browser to protect this data from automatic clearing, and its answer. */
  persistence?: { requested: boolean; granted: boolean }
  /** The install offer on the end screen is shown once. */
  installOffered?: boolean
  /** The "Tune your picks" card on Your Shortlist was dismissed. */
  tuneDismissed?: boolean
  /** Seasonal themes (welcome art, subtitle, Tales for Longer Nights). On unless set to false. */
  seasonalThemes?: boolean
  /** The works in today's seasonal row, kept so their books can be stored for offline. */
  talesRow?: DailyShortlist
}

export interface ProfileStore {
  get(): Promise<Profile | undefined>
  put(profile: Profile): Promise<void>
  clear(): Promise<void>
}

/** Append-only: there is deliberately no way to edit or delete one event. */
export interface EventLog {
  append(event: NewReaderEvent): Promise<ReaderEvent>
  /** All events, oldest first. */
  list(): Promise<ReaderEvent[]>
  /** Events for one work, oldest first. */
  listForWork(workId: string): Promise<ReaderEvent[]>
}

export interface LibraryStore {
  get(workId: string): Promise<SavedWork | undefined>
  /** Newest first. */
  list(): Promise<SavedWork[]>
  save(
    workId: string,
    options?: { shelf?: string; offline?: boolean; addedAt?: number },
  ): Promise<SavedWork>
  remove(workId: string): Promise<void>
}

export interface ProgressStore {
  get(workId: string): Promise<Progress | undefined>
  /** Saves the position and stamps updatedAt. */
  set(progress: Omit<Progress, 'updatedAt'>): Promise<Progress>
  list(): Promise<Progress[]>
  remove(workId: string): Promise<void>
}

export interface HighlightStore {
  add(highlight: Omit<Highlight, 'id'>): Promise<Highlight>
  listForWork(workId: string): Promise<Highlight[]>
  remove(id: string): Promise<void>
}

export interface SettingsStore {
  /** Returns the saved settings, or the defaults if none are saved yet. */
  get(): Promise<Settings>
  update(changes: Partial<Omit<Settings, 'id'>>): Promise<Settings>
}

/** The six colours a reading profile can have. Each has a name, so colour is never the only cue. */
export const PROFILE_COLORS = [
  { id: 'rust', name: 'Rust' },
  { id: 'forest', name: 'Forest' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'plum', name: 'Plum' },
  { id: 'gold', name: 'Gold' },
  { id: 'slate', name: 'Slate' },
] as const

export type ProfileColor = (typeof PROFILE_COLORS)[number]['id']

/** Most reading profiles one device keeps (the guest is extra). */
export const MAX_READING_PROFILES = 6
/** Longest name a reading profile can have. */
export const MAX_PROFILE_NAME = 20

/**
 * One person's reading on this device (UI label: "Profile"). Not an account. Called a "reading
 * profile" in code so it is never confused with the taste `Profile` above.
 */
export interface ReadingProfile {
  id: string
  name: string
  color: ProfileColor
  createdAt: number
  lastUsedAt: number
}
