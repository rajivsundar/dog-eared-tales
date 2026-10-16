import { useEffect, useState } from 'react'
import { loadCatalog } from '../../catalog'
import { buildProfile, whyThisPick } from '../../engine/recommend'
import type { Profile } from '../../stores'
import {
  eventLog,
  profileStore,
  progressStore,
  settingsStore,
} from '../../stores'
import { useDogEar } from '../library/useDogEar'
import { UndoToast } from '../ui/UndoToast'
import { DetailSheet } from '../detail/DetailSheet'
import { minutesLabel } from '../detail/labels'
import {
  type ShortlistDeps,
  type ShortlistPick,
  loadShortlist,
  recordShown,
  recordTap,
  removePick,
  shortlistTitle,
  undoRemove,
} from './dailyShortlist'

interface Removed {
  key: number
  workId: string
  previous: ShortlistPick[]
}

/** Your Shortlist (Tonight's Shortlist from 6 pm to 4 am): today's 6 picks. */
export function ShortlistScreen() {
  const [now] = useState(() => new Date())
  const [catalogDeps, setCatalogDeps] = useState<ShortlistDeps | null>(null)
  const [picks, setPicks] = useState<ShortlistPick[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const dogEar = useDogEar()
  const [beliefs, setBeliefs] = useState<Profile['facetBeliefs']>({})
  const [removed, setRemoved] = useState<Removed | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const catalog = await loadCatalog()
        const deps: ShortlistDeps = {
          catalog,
          settings: settingsStore,
          profile: profileStore,
          events: eventLog,
          progress: progressStore,
        }
        const list = await loadShortlist(deps, now)
        if (cancelled) return
        await recordShown(deps, list, now)
        if (cancelled) return
        setBeliefs(
          buildProfile(catalog, await eventLog.list(), now.getTime())
            .facetBeliefs,
        )
        if (cancelled) return
        setCatalogDeps(deps)
        setPicks(list)
      } catch (error) {
        console.error(error)
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [now])

  const open = picks?.find((p) => p.entry.id === openId)

  const fail = (error: unknown): void => {
    console.error(error)
    setFailed(true)
  }

  const openSheet = (id: string): void => {
    setOpenId(id)
    void recordTap({ events: eventLog }, id).catch(fail)
  }

  const onDogEar = (id: string): void => {
    setRemoved(null)
    dogEar.toggle(id)
  }

  const onNotForMe = (id: string): void => {
    if (!catalogDeps || !picks) return
    setOpenId(null)
    dogEar.dismiss()
    const previous = picks
    removePick(catalogDeps, previous, id, new Date())
      .then(async ({ picks: next, replacement }) => {
        setPicks(next)
        setRemoved({ key: Date.now(), workId: id, previous })
        if (replacement) {
          await recordShown(catalogDeps, [replacement], new Date())
        }
      })
      .catch(fail)
  }

  const onUndo = (): void => {
    if (!catalogDeps || !removed) return
    const { previous, workId } = removed
    setRemoved(null)
    setPicks(previous)
    undoRemove(catalogDeps, previous, workId, new Date()).catch(fail)
  }

  return (
    <section aria-labelledby="shortlist-title" className="mt-8">
      <h2
        id="shortlist-title"
        className="font-serif text-2xl font-bold sm:text-3xl"
      >
        {shortlistTitle(now)}
      </h2>

      {failed && (
        <p role="alert" className="mt-4">
          We couldn’t load the stories.
        </p>
      )}
      {!picks && !failed && <p className="mt-4 text-muted">Loading…</p>}
      {picks && picks.length === 0 && (
        <p className="mt-4 text-muted">
          You’ve been through everything for now. Check back soon.
        </p>
      )}

      {picks && (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map(({ entry, reason }) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => openSheet(entry.id)}
                className="flex h-full w-full gap-4 rounded-card border border-line bg-surface p-3 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <img
                  src={entry.coverUrl}
                  alt=""
                  loading="lazy"
                  className="h-28 w-[4.5rem] shrink-0 rounded-md border border-line object-cover"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-serif text-lg leading-snug font-bold">
                    {entry.title}
                  </span>
                  <span className="text-sm">{entry.author}</span>
                  <span className="mt-1 text-sm text-muted">
                    {minutesLabel(entry.readingMinutes)}
                  </span>
                  <span className="mt-auto pt-2 text-sm font-medium text-accent">
                    {reason}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <DetailSheet
          entry={open.entry}
          reason={open.reason}
          why={whyThisPick(open.entry, open.reason, beliefs)}
          dogEared={dogEar.ids.has(open.entry.id)}
          onClose={() => setOpenId(null)}
          onDogEar={() => onDogEar(open.entry.id)}
          onNotForMe={() => onNotForMe(open.entry.id)}
        />
      )}

      {dogEar.removed && (
        <UndoToast
          key={dogEar.removed.key}
          onUndo={dogEar.undo}
          onExpire={dogEar.dismiss}
        />
      )}
      {removed && !dogEar.removed && (
        <UndoToast
          key={removed.key}
          onUndo={onUndo}
          onExpire={() => setRemoved(null)}
        />
      )}
    </section>
  )
}
