import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { type CatalogEntry, loadCatalog } from '../../catalog'
import {
  type SavedWork,
  eventLog,
  libraryStore,
  progressStore,
} from '../../stores'
import { CheckIn } from '../checkin/CheckIn'
import { RATING_LABELS, recordRating } from '../checkin/rating'
import type { Rating } from '../checkin/rating'
import { minutesLabel } from '../detail/labels'
import { OfflineBadge } from '../offline/OfflineBadge'
import { useAutoCache, useCachedTexts } from '../offline/useOffline'
import { UndoToast } from '../ui/UndoToast'
import { type LibraryLists, sortLibrary } from './libraryLists'

const TABS = [
  { id: 'dog-eared', label: 'Kept' },
  { id: 'reading', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
] as const
type TabId = (typeof TABS)[number]['id']

const EMPTY: Record<TabId, string> = {
  reading:
    'Nothing in progress yet. Start a story and it will wait for you here.',
  'dog-eared': 'Nothing kept yet. Dog-ear a story and it waits here.',
  finished: 'No finished stories yet. Your first one will be here.',
}

const cover = 'h-20 w-14 shrink-0 rounded-md border border-line object-cover'
const card =
  'flex min-h-11 flex-1 items-center gap-4 rounded-card border border-line bg-surface p-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function finishDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface Removed {
  key: number
  saved: SavedWork
}

/** The Library at /library: Kept, Reading and Finished. */
export default function LibraryScreen() {
  const [params, setParams] = useSearchParams()
  const tab: TabId =
    TABS.find((t) => t.id === params.get('tab'))?.id ?? 'dog-eared'

  const [lists, setLists] = useState<LibraryLists | null>(null)
  const [failed, setFailed] = useState(false)
  const [removed, setRemoved] = useState<Removed | null>(null)
  const [rating, setRating] = useState<CatalogEntry | null>(null)
  const cached = useCachedTexts()
  // Dog-eared and Reading works are kept ready for offline.
  useAutoCache(
    lists
      ? [...lists.dogEared, ...lists.reading].map((i) => i.entry.id).join(',')
      : '',
  )
  // Writes run one after another, so a quick Undo never overtakes the removal.
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = (task: () => Promise<unknown>): void => {
    writes.current = writes.current.then(task).catch(fail)
  }

  const load = useCallback(async (): Promise<LibraryLists> => {
    const [catalog, progress, library, events] = await Promise.all([
      loadCatalog() as Promise<CatalogEntry[]>,
      progressStore.list(),
      libraryStore.list(),
      eventLog.list(),
    ])
    return sortLibrary({ catalog, progress, library, events })
  }, [])

  useEffect(() => {
    let cancelled = false
    load()
      .then((next) => {
        if (!cancelled) setLists(next)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const refresh = (): void => {
    load().then(setLists).catch(fail)
  }
  function fail(error: unknown): void {
    console.error(error)
    setFailed(true)
  }

  const unDogEar = (saved: SavedWork): void => {
    setLists((prev) =>
      prev
        ? {
            ...prev,
            dogEared: prev.dogEared.filter((d) => d.entry.id !== saved.workId),
          }
        : prev,
    )
    setRemoved({ key: Date.now(), saved })
    enqueue(async () => {
      await eventLog.append({ workId: saved.workId, type: 'unsave' })
      await libraryStore.remove(saved.workId)
    })
  }

  const undo = (): void => {
    if (!removed) return
    const { saved } = removed
    setRemoved(null)
    enqueue(async () => {
      await libraryStore.save(saved.workId, {
        shelf: saved.shelf,
        offline: saved.offline,
        addedAt: saved.addedAt,
      })
      await eventLog.append({
        workId: saved.workId,
        type: 'undo',
        reason: 'unsave',
      })
      refresh()
    })
  }

  const onTabKey = (e: KeyboardEvent): void => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const index = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(index + step + TABS.length) % TABS.length]
    setParams({ tab: next.id }, { replace: true })
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <main className="mx-auto max-w-3xl px-gutter py-8 sm:py-12">
      <h1 className="font-serif text-3xl font-bold">Library</h1>

      <div
        role="tablist"
        aria-label="Library"
        onKeyDown={onTabKey}
        className="mt-5 flex border-b border-line"
      >
        {TABS.map((t) => {
          const selected = t.id === tab
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="library-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={`min-h-11 flex-1 border-b-2 px-3 text-base focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent text-muted'
              }`}
            >
              {t.label}
              {lists && (
                <span className="ml-1 text-sm font-normal">
                  ({lists[t.id === 'dog-eared' ? 'dogEared' : t.id].length})
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="library-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mt-4"
      >
        {failed && <p role="alert">We couldn’t load your library.</p>}
        {!lists && !failed && <p className="text-muted">Loading…</p>}
        {lists && (
          <Panel
            tab={tab}
            lists={lists}
            onUnDogEar={unDogEar}
            onRate={setRating}
            cached={cached}
          />
        )}
      </div>

      {rating && (
        <RateDialog
          entry={rating}
          onRate={(rate, reason) => {
            recordRating(eventLog, rating.id, rate, reason)
              .then(refresh)
              .catch(fail)
          }}
          onClose={() => setRating(null)}
        />
      )}

      {removed && (
        <UndoToast
          key={removed.key}
          onUndo={undo}
          onExpire={() => setRemoved(null)}
        />
      )}
    </main>
  )
}

function Panel({
  tab,
  lists,
  onUnDogEar,
  onRate,
  cached,
}: {
  tab: TabId
  lists: LibraryLists
  onUnDogEar: (saved: SavedWork) => void
  onRate: (entry: CatalogEntry) => void
  cached: ReadonlySet<string>
}) {
  const count =
    tab === 'reading'
      ? lists.reading.length
      : tab === 'dog-eared'
        ? lists.dogEared.length
        : lists.finished.length
  if (count === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <p>{EMPTY[tab]}</p>
        <Link
          to="/"
          className="mt-3 inline-flex min-h-11 items-center font-semibold text-accent underline"
        >
          Go to Your Shortlist
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {tab === 'reading' &&
        lists.reading.map(({ entry, percent, minutesLeft }) => (
          <li key={entry.id} className="flex">
            <Link to={`/read/${entry.id}`} className={card}>
              <img src={entry.coverUrl} alt="" className={cover} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-serif text-lg leading-snug font-bold">
                  {entry.title}
                </span>
                <span className="text-sm">{entry.author}</span>
                <span
                  role="progressbar"
                  aria-label={`Progress through ${entry.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percent)}
                  className="mt-1 block h-1.5 overflow-hidden rounded bg-line"
                >
                  <span
                    className="block h-full rounded bg-accent"
                    style={{ width: `${Math.round(percent)}%` }}
                  />
                </span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {minutesLeft} min left
                  <OfflineBadge available={cached.has(entry.textUrl)} />
                </span>
              </span>
            </Link>
          </li>
        ))}

      {tab === 'dog-eared' &&
        lists.dogEared.map(({ entry, saved }) => (
          <li key={entry.id} className="flex items-stretch gap-2">
            <Link to={`/read/${entry.id}`} className={card}>
              <img src={entry.coverUrl} alt="" className={cover} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-serif text-lg leading-snug font-bold">
                  {entry.title}
                </span>
                <span className="text-sm">{entry.author}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {minutesLabel(entry.readingMinutes)}
                  <OfflineBadge available={cached.has(entry.textUrl)} />
                </span>
              </span>
            </Link>
            <button
              type="button"
              aria-label={`Un-dog-ear ${entry.title}`}
              onClick={() => onUnDogEar(saved)}
              className="min-h-11 min-w-11 shrink-0 rounded-card border border-line px-3 text-sm text-muted hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Un-dog-ear
            </button>
          </li>
        ))}

      {tab === 'finished' &&
        lists.finished.map(({ entry, at, rating }) => (
          <li key={entry.id} className="flex items-stretch gap-2">
            <Link to={`/read/${entry.id}`} className={card}>
              <img src={entry.coverUrl} alt="" className={cover} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-serif text-lg leading-snug font-bold">
                  {entry.title}
                </span>
                <span className="text-sm">{entry.author}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                  Finished {finishDate(at)}
                  {rating && ` · ${RATING_LABELS[rating]}`}
                  <OfflineBadge available={cached.has(entry.textUrl)} />
                </span>
              </span>
            </Link>
            {!rating && (
              <button
                type="button"
                aria-label={`Rate ${entry.title}`}
                onClick={() => onRate(entry)}
                className="min-h-11 min-w-11 shrink-0 rounded-card border border-line px-3 text-sm font-semibold text-accent hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Rate it
              </button>
            )}
          </li>
        ))}
    </ul>
  )
}

/** The check-in in a small dialog, for rating a finished work from the Library. */
function RateDialog({
  entry,
  onRate,
  onClose,
}: {
  entry: CatalogEntry
  onRate: (rating: Rating, reason?: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-title"
        className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 text-center text-ink shadow-xl sm:rounded-2xl"
      >
        <h2 id="rate-title" className="font-serif text-xl font-bold">
          {entry.title}
        </h2>
        <div className="mt-4">
          <CheckIn onRate={onRate} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-11 px-4 text-muted underline"
        >
          Close
        </button>
      </div>
    </div>
  )
}
