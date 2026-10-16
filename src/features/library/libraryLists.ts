import type { CatalogEntry } from '../../catalog'
import type { Progress, ReaderEvent, SavedWork } from '../../stores'

/** Reading speed, as in the reader and the catalog. */
const WORDS_PER_MINUTE = 238

export interface ReadingItem {
  entry: CatalogEntry
  /** 0 to 100. */
  percent: number
  minutesLeft: number
  /** When the position was last saved. */
  at: number
}

export interface DogEaredItem {
  entry: CatalogEntry
  saved: SavedWork
}

export interface FinishedItem {
  entry: CatalogEntry
  /** When the story was finished. */
  at: number
}

export interface LibraryLists {
  reading: ReadingItem[]
  dogEared: DogEaredItem[]
  finished: FinishedItem[]
}

export function minutesLeftFor(entry: CatalogEntry, percent: number): number {
  const wordsLeft = entry.wordCount * (1 - percent / 100)
  return Math.max(1, Math.ceil(wordsLeft / WORDS_PER_MINUTE))
}

/**
 * Puts each work in at most one tab:
 * - Finished: it has a finished event, unless the reader has since started it again.
 * - Reading: the reader has turned at least one page (saved progress above 0, below 100).
 * - Dog-eared: kept for later and not started. Just opening a story does not start it.
 * Each tab is newest first.
 */
export function sortLibrary(input: {
  catalog: CatalogEntry[]
  progress: Progress[]
  library: SavedWork[]
  events: ReaderEvent[]
}): LibraryLists {
  const byId = new Map(input.catalog.map((e) => [e.id, e]))
  const progressById = new Map(input.progress.map((p) => [p.workId, p]))
  const lastFinished = new Map<string, number>()
  for (const e of input.events) {
    if (e.type === 'finished') {
      lastFinished.set(
        e.workId,
        Math.max(lastFinished.get(e.workId) ?? 0, e.at),
      )
    }
  }

  const lists: LibraryLists = { reading: [], dogEared: [], finished: [] }
  const placed = new Set<string>()

  const consider = (id: string): void => {
    const entry = byId.get(id)
    if (!entry || placed.has(id)) return
    placed.add(id)
    const progress = progressById.get(id)
    const finishedAt = lastFinished.get(id)
    const turned = Boolean(
      progress && progress.percent > 0 && progress.percent < 100,
    )
    const startedAgain = Boolean(
      progress && finishedAt !== undefined && progress.updatedAt > finishedAt,
    )
    if (finishedAt !== undefined && !(turned && startedAgain)) {
      lists.finished.push({ entry, at: finishedAt })
    } else if (progress && turned) {
      lists.reading.push({
        entry,
        percent: progress.percent,
        minutesLeft: minutesLeftFor(entry, progress.percent),
        at: progress.updatedAt,
      })
    } else if (input.library.some((s) => s.workId === id)) {
      const saved = input.library.find((s) => s.workId === id)!
      lists.dogEared.push({ entry, saved })
    } else {
      placed.delete(id)
    }
  }

  for (const p of input.progress) consider(p.workId)
  for (const s of input.library) consider(s.workId)
  for (const id of lastFinished.keys()) consider(id)

  lists.reading.sort(
    (a, b) => b.at - a.at || a.entry.id.localeCompare(b.entry.id),
  )
  lists.dogEared.sort(
    (a, b) =>
      b.saved.addedAt - a.saved.addedAt || a.entry.id.localeCompare(b.entry.id),
  )
  lists.finished.sort(
    (a, b) => b.at - a.at || a.entry.id.localeCompare(b.entry.id),
  )
  return lists
}
