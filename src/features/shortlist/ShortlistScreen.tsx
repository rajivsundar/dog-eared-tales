import { useEffect, useState } from 'react'
import { loadCatalog } from '../../catalog'
import {
  buildProfile,
  sittingMinutes,
  whyThisPick,
} from '../../engine/recommend'
import type { Profile } from '../../stores'
import {
  eventLog,
  profileManager,
  profileStore,
  progressStore,
  settingsStore,
} from '../../stores'
import { useDogEar } from '../library/useDogEar'
import { UndoToast } from '../ui/UndoToast'
import { DetailSheet } from '../detail/DetailSheet'
import { minutesLabel } from '../detail/labels'
import {
  persistenceDeps,
  requestPersistenceIfEarned,
} from '../storage/persistence'
import { TuneCard } from '../onboarding/TuneCard'
import { hasAnsweredCards } from '../onboarding/finishOnboarding'
import { OfflineBadge } from '../offline/OfflineBadge'
import { useSeasonArt } from '../../app/seasonArt/useSeasonArt'
import { useSeason } from '../../app/useSeason'
import { ReadingAs } from '../profiles/ReadingAs'
import { TalesSection } from './TalesSection'
import { loadTalesRow, removeTale, undoRemoveTale } from './talesRow'
import { useAutoCache, useCachedTexts } from '../offline/useOffline'
import { LongListSection } from './LongListSection'
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
import {
  loadLongList,
  removeLongListPick,
  undoRemoveLongList,
} from './longList'

interface Removed {
  key: number
  workId: string
  /** Which list the work was removed from. */
  list: 'short' | 'long' | 'tales'
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
  const cached = useCachedTexts()
  const [beliefs, setBeliefs] = useState<Profile['facetBeliefs']>({})
  const [removed, setRemoved] = useState<Removed | null>(null)
  const [showTune, setShowTune] = useState(false)
  const [longPicks, setLongPicks] = useState<ShortlistPick[]>([])
  const [sitting, setSitting] = useState(15)
  const [loadedTales, setTales] = useState<ShortlistPick[]>([])
  const { season } = useSeason(now)
  const art = useSeasonArt(season?.art)
  // Nothing is shown (or kept for offline) once the season is over or switched off.
  const tales = season ? loadedTales : []

  // The seasonal row (Tales for Longer Nights), while a season is on and seasonal themes are too.
  useEffect(() => {
    if (!catalogDeps || !season) return
    let cancelled = false
    loadTalesRow(
      catalogDeps,
      season,
      now,
      (picks ?? []).map((p) => p.entry.id),
    )
      .then((row) => {
        if (!cancelled) setTales(row)
      })
      .catch((error: unknown) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [catalogDeps, season, now, picks])

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
        void requestPersistenceIfEarned(
          persistenceDeps(profileManager, eventLog),
        )
        if (cancelled) return
        const long = await loadLongList(
          deps,
          list.map((p) => p.entry.id),
          now,
        )
        if (cancelled) return
        await recordShown(deps, [...list, ...long], now)
        if (cancelled) return
        const events = await eventLog.list()
        // "Tune your picks": after the first finished story, until dismissed or the cards are done.
        const settings = await settingsStore.get()
        setShowTune(
          !settings.tuneDismissed &&
            events.some((e) => e.type === 'finished') &&
            !hasAnsweredCards(events),
        )
        setBeliefs(buildProfile(catalog, events, now.getTime()).facetBeliefs)
        setSitting(sittingMinutes(events))
        if (cancelled) return
        setCatalogDeps(deps)
        setPicks(list)
        setLongPicks(long)
      } catch (error) {
        console.error(error)
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [now])

  // Keep the books for these lists (and Dog-eared and Reading works) ready for offline.
  useAutoCache(
    [
      ...(picks ?? []).map((p) => p.entry.id),
      '|',
      ...longPicks.map((p) => p.entry.id),
      '|',
      ...tales.map((p) => p.entry.id),
      '|',
      ...[...dogEar.ids],
    ].join(','),
  )

  const openShort = picks?.find((p) => p.entry.id === openId)
  const openLong = longPicks.find((p) => p.entry.id === openId)
  const openTale = tales.find((p) => p.entry.id === openId)
  const open = openShort ?? openLong ?? openTale

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
    if (season && tales.some((p) => p.entry.id === id)) {
      const previous = tales
      removeTale(
        catalogDeps,
        season,
        previous,
        id,
        new Date(),
        (picks ?? []).map((p) => p.entry.id),
      )
        .then((next) => {
          setTales(next)
          setRemoved({ key: Date.now(), workId: id, list: 'tales', previous })
        })
        .catch(fail)
      return
    }
    const isLong = longPicks.some((p) => p.entry.id === id)
    const previous = isLong ? longPicks : picks
    const shortIds = picks.map((p) => p.entry.id)
    const run = isLong
      ? removeLongListPick(catalogDeps, previous, id, shortIds, new Date())
      : removePick(catalogDeps, previous, id, new Date())
    run
      .then(async ({ picks: next, replacement }) => {
        if (isLong) setLongPicks(next)
        else setPicks(next)
        setRemoved({
          key: Date.now(),
          workId: id,
          list: isLong ? 'long' : 'short',
          previous,
        })
        if (replacement) {
          await recordShown(catalogDeps, [replacement], new Date())
        }
      })
      .catch(fail)
  }

  const onUndo = (): void => {
    if (!catalogDeps || !removed) return
    const { previous, workId, list } = removed
    setRemoved(null)
    if (list === 'tales') {
      setTales(previous)
      undoRemoveTale(catalogDeps, previous, workId, new Date()).catch(fail)
    } else if (list === 'long') {
      setLongPicks(previous)
      undoRemoveLongList(catalogDeps, previous, workId, new Date()).catch(fail)
    } else {
      setPicks(previous)
      undoRemove(catalogDeps, previous, workId, new Date()).catch(fail)
    }
  }

  return (
    <>
      {showTune && (
        <TuneCard
          onDismiss={() => {
            setShowTune(false)
            settingsStore.update({ tuneDismissed: true }).catch(fail)
          }}
        />
      )}
      <section aria-labelledby="shortlist-title" className="mt-8">
        <ReadingAs />
        <h2
          id="shortlist-title"
          className="font-serif text-2xl font-bold sm:text-3xl"
        >
          {art && <art.Accent />}
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
                    <span className="mt-1 flex items-center gap-2 text-sm text-muted">
                      {minutesLabel(entry.readingMinutes)}
                      <OfflineBadge available={cached.has(entry.textUrl)} />
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
      </section>

      {season && tales.length > 0 && (
        <TalesSection
          title={season.talesRow.title}
          picks={tales}
          cached={cached}
          onOpen={openSheet}
        />
      )}

      {longPicks.length > 0 && (
        <LongListSection
          picks={longPicks}
          sitting={sitting}
          cached={cached}
          onOpen={openSheet}
        />
      )}

      {open && (
        <DetailSheet
          entry={open.entry}
          reason={open.reason}
          offline={cached.has(open.entry.textUrl)}
          why={whyThisPick(
            open.entry,
            open.reason,
            beliefs,
            openLong ? 'long' : 'shortlist',
          )}
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
    </>
  )
}
