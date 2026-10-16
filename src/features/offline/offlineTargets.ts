import type { CatalogEntry } from '../../catalog'
import type {
  DailyShortlist,
  Progress,
  ReaderEvent,
  SavedWork,
} from '../../stores'
import { sortLibrary } from '../library/libraryLists'

export interface OfflineInput {
  catalog: CatalogEntry[]
  shortlist?: DailyShortlist
  longList?: DailyShortlist
  library: SavedWork[]
  progress: Progress[]
  events: ReaderEvent[]
  /** Today's date as "YYYY-MM-DD". Lists made on another day are ignored. */
  today: string
}

/**
 * The book files to keep for offline reading: every pick on today's Your Shortlist and Your Long
 * List, every Dog-eared work, and every work under Reading. Each file once, even when several
 * works share it.
 */
export function offlineTargets(input: OfflineInput): string[] {
  const byId = new Map(input.catalog.map((e) => [e.id, e]))
  const ids: string[] = []
  for (const list of [input.shortlist, input.longList]) {
    if (list && list.date === input.today) {
      ids.push(...list.picks.map((p) => p.workId))
    }
  }
  const { reading, dogEared } = sortLibrary({
    catalog: input.catalog,
    progress: input.progress,
    library: input.library,
    events: input.events,
  })
  ids.push(
    ...reading.map((r) => r.entry.id),
    ...dogEared.map((d) => d.entry.id),
  )

  const urls = ids.flatMap((id) => {
    const entry = byId.get(id)
    return entry ? [entry.textUrl] : []
  })
  return [...new Set(urls)]
}
