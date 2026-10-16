// In-memory stand-ins for the stores, for tests only.
import type {
  EventLog,
  LibraryStore,
  Profile,
  ProfileStore,
  Progress,
  ProgressStore,
  ReaderEvent,
  SavedWork,
  Settings,
  SettingsStore,
} from '../../stores'

export function fakeStores() {
  let settings: Settings = {
    id: 'settings',
    theme: 'system',
    font: 'literata',
    textSize: 5,
    mix: 'default',
    aiPrefs: {},
    contentFilters: {},
  }
  const events: ReaderEvent[] = []
  const library = new Map<string, SavedWork>()
  const progress = new Map<string, Progress>()
  let counter = 0

  const settingsStore: SettingsStore = {
    get: async () => settings,
    update: async (changes) => {
      settings = { ...settings, ...changes }
      return settings
    },
  }
  const eventLog: EventLog = {
    append: async (event) => {
      const saved = {
        ...event,
        id: `e${counter++}`,
        at: event.at ?? Date.now(),
      }
      events.push(saved)
      return saved
    },
    list: async () => [...events],
    listForWork: async (id) => events.filter((e) => e.workId === id),
  }
  let profile: Profile | undefined
  const profileStore: ProfileStore = {
    get: async () => profile,
    put: async (p) => {
      profile = p
    },
    clear: async () => {
      profile = undefined
    },
  }
  const libraryStore: LibraryStore = {
    get: async (id) => library.get(id),
    list: async () =>
      [...library.values()].sort((a, b) => b.addedAt - a.addedAt),
    save: async (workId, options = {}) => {
      const item = {
        workId,
        shelf: options.shelf ?? 'default',
        addedAt: library.get(workId)?.addedAt ?? options.addedAt ?? Date.now(),
        offline: options.offline ?? false,
      }
      library.set(workId, item)
      return item
    },
    remove: async (id) => {
      library.delete(id)
    },
  }
  const progressStore: ProgressStore = {
    get: async (id) => progress.get(id),
    set: async (p) => {
      const saved = { ...p, updatedAt: Date.now() }
      progress.set(p.workId, saved)
      return saved
    },
    list: async () =>
      [...progress.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    remove: async (id) => {
      progress.delete(id)
    },
  }
  return {
    progressStore,
    settingsStore,
    eventLog,
    profileStore,
    libraryStore,
    events,
    library,
    progress,
  }
}

/** Ten small catalog entries, enough for 6 picks and replacements. */
export function fakeCatalog() {
  const moods = ['cozy', 'eerie', 'funny', 'romantic', 'tense']
  return Array.from({ length: 10 }, (_, i) => ({
    id: `story-${i}`,
    title: `Story ${i}`,
    author: `Author ${i}`,
    bookTitle: i === 1 ? 'A Big Book / or, Subtitle' : `Story ${i}`,
    isCollection: i === 1,
    language: 'en',
    wordCount: 2000,
    readingMinutes: 8 + i,
    lengthClass: i < 4 ? 'under10' : '10to30',
    readingLevel: { grade: 6, band: 'easy' },
    firstLine: `First line ${i}.`,
    textUrl: '',
    coverUrl: `/covers/story-${i}.svg`,
    startHref: `s${i}.xhtml#start`,
    endHref: `s${i}.xhtml#end`,
    sha256: '',
    source: 'Project Gutenberg',
    sourceUrl: `https://www.gutenberg.org/ebooks/${i}`,
    license: 'Project Gutenberg License',
    year: 1900 + i,
    eraBand: '1850-1899',
    form: i === 5 ? 'essay' : 'story',
    genres: ['literary'],
    moods: [moods[i % moods.length]],
    contentNotes: i === 2 ? ['violence'] : [],
    hook: `Hook ${i}`,
    blurb: `Blurb ${i}`,
    generatedBy: 'claude-code',
    reviewed: true,
  }))
}
