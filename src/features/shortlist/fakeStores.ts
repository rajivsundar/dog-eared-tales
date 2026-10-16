// In-memory stand-ins for the stores, for tests only.
import type {
  EventLog,
  LibraryStore,
  ProfileStore,
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
  const profileStore: ProfileStore = {
    get: async () => undefined,
    put: async () => {},
    clear: async () => {},
  }
  const libraryStore: LibraryStore = {
    get: async (id) => library.get(id),
    list: async () => [...library.values()],
    save: async (workId) => {
      const item = {
        workId,
        shelf: 'default',
        addedAt: Date.now(),
        offline: false,
      }
      library.set(workId, item)
      return item
    },
    remove: async (id) => {
      library.delete(id)
    },
  }
  return {
    settingsStore,
    eventLog,
    profileStore,
    libraryStore,
    events,
    library,
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
