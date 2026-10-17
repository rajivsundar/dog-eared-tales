import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { type CatalogEntry, getEntry } from '../../catalog'
import {
  type LocationInfo,
  type ReaderEngine,
  type ReaderStyle,
  THEME_COLORS,
  createReaderEngine,
  resolveTheme,
} from '../../engine/reader'
import {
  eventLog,
  profileManager,
  progressStore,
  settingsStore,
} from '../../stores'
import { recordRating } from '../checkin/rating'
import { useDogEar } from '../library/useDogEar'
import {
  persistenceDeps,
  requestPersistenceIfEarned,
} from '../storage/persistence'
import { useInstallOffer } from '../storage/useInstallOffer'
import { useReadingSession } from './useReadingSession'
import { UndoToast } from '../ui/UndoToast'
import { swipeDirection } from './swipe'
import { AaPanel } from './AaPanel'
import { EndScreen } from './EndScreen'
import { ProgressBar } from './ProgressBar'
import { type ProgressTracker, createProgressTracker } from './progressTracker'

type Phase = 'loading' | 'ready' | 'finished' | 'missing' | 'offline' | 'error'

function useDeviceIsDark(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(
    () => globalThis.matchMedia?.(query).matches ?? false,
  )
  useEffect(() => {
    const list = globalThis.matchMedia?.(query)
    if (!list) return
    const onChange = (): void => setDark(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])
  return dark
}

const DEFAULT_STYLE: ReaderStyle = {
  font: 'literata',
  sizeStep: 5,
  theme: 'system',
}

/** The reading screen at /read/:id. Each story gets a fresh screen, so nothing carries over between stories. */
export default function ReaderScreen() {
  const { id = '' } = useParams()
  return <Reader key={id} id={id} />
}

function Reader({ id }: { id: string }) {
  const navigate = useNavigate()
  const dark = useDeviceIsDark()
  const dogEar = useDogEar()
  const sessionActivity = useReadingSession(id)
  const dogEared = dogEar.ids.has(id)
  const dogEarLabel = dogEared ? 'Dog-eared' : 'Dog-ear it for later'

  const [phase, setPhase] = useState<Phase>('loading')
  const [entry, setEntry] = useState<CatalogEntry | null>(null)
  const [location, setLocation] = useState<LocationInfo | null>(null)
  const [style, setStyle] = useState<ReaderStyle>(DEFAULT_STYLE)
  const [panelOpen, setPanelOpen] = useState(false)
  const [barsVisible, setBarsVisible] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [hintSeen, setHintSeen] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ReaderEngine | null>(null)
  const phaseRef = useRef<Phase>('loading')
  const panelRef = useRef(false)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    panelRef.current = panelOpen
  }, [panelOpen])

  // Open the story.
  useEffect(() => {
    let closed = false
    let engine: ReaderEngine | null = null
    let tracker: ProgressTracker | null = null
    ;(async () => {
      try {
        const found = await getEntry(id)
        if (closed) return
        if (!found) {
          setPhase('missing')
          return
        }
        setEntry(found)
        const [saved, settings] = await Promise.all([
          progressStore.get(id),
          settingsStore.get(),
        ])
        if (closed) return
        const initialStyle: ReaderStyle = {
          font: settings.font,
          sizeStep: settings.textSize,
          theme: settings.theme,
        }
        setStyle(initialStyle)
        setHintSeen(settings.readerHintSeen === true)

        const container = containerRef.current
        if (!container) throw new Error('the reading area is not ready')
        engine = createReaderEngine(container)
        engineRef.current = engine
        engine.setStyle(initialStyle)

        // A finished story starts again from the beginning.
        const resume = saved && saved.percent < 100 ? saved : undefined
        tracker = createProgressTracker({
          workId: id,
          progress: progressStore,
          events: eventLog,
          startFraction: resume ? resume.percent / 100 : 0,
          startSeconds: saved?.secondsRead ?? 0,
          hadProgress: Boolean(resume),
        })
        let finished = false
        engine.onLocation((loc) => {
          setLocation(loc)
          sessionActivity()
          void tracker?.location(loc)
        })
        engine.onRangeEnd(() => {
          if (finished) return
          finished = true
          setPhase('finished')
          void tracker
            ?.finished()
            .then(() =>
              requestPersistenceIfEarned(
                persistenceDeps(profileManager, eventLog),
              ),
            )
        })
        await engine.open(found.textUrl, {
          startHref: found.startHref,
          endHref: found.endHref,
          startAtText: found.startAtText,
          endBeforeText: found.endBeforeText,
          locator: resume?.locator,
        })
        if (closed) {
          engine.close()
          return
        }
        void tracker.opened()
        setPhase('ready')
      } catch (error) {
        if (!closed) {
          // Offline, a book that was never stored cannot be fetched: that is not an error.
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setPhase('offline')
            return
          }
          console.error(error)
          setErrorText(error instanceof Error ? error.message : String(error))
          setPhase('error')
        }
      }
    })()
    return () => {
      closed = true
      engineRef.current = null
      engine?.close()
    }
  }, [id, sessionActivity])

  // Keep a device-theme reader in step with the device.
  useEffect(() => {
    engineRef.current?.setStyle(style)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])

  const dismissHint = useCallback(() => {
    setHintSeen((seen) => {
      if (!seen) void settingsStore.update({ readerHintSeen: true })
      return true
    })
  }, [])

  const turn = useCallback(
    (direction: 'next' | 'prev') => {
      if (phaseRef.current !== 'ready') return
      dismissHint()
      void (direction === 'next'
        ? engineRef.current?.next()
        : engineRef.current?.prev())
    },
    [dismissHint],
  )

  // A swipe sideways turns the page: left for next, right for previous. Taps still go to the buttons.
  const gestureRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent): void => {
    gestureRef.current =
      e.pointerType === 'mouse'
        ? null
        : { x: e.clientX, y: e.clientY, t: e.timeStamp }
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    const start = gestureRef.current
    gestureRef.current = null
    if (!start || panelRef.current) return
    const direction = swipeDirection({
      startX: start.x,
      startY: start.y,
      endX: e.clientX,
      endY: e.clientY,
      ms: e.timeStamp - start.t,
      screenWidth: window.innerWidth,
    })
    if (direction) turn(direction)
  }

  // Arrow keys, Page Up/Down and Space turn pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'Escape' && panelRef.current) {
        setPanelOpen(false)
        return
      }
      if (panelRef.current) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input, select, textarea')) return
      if (e.key === ' ' && target?.closest('button, a')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        turn(e.shiftKey && e.key === ' ' ? 'prev' : 'next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        turn('prev')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turn])

  const changeStyle = (change: Partial<ReaderStyle>): void => {
    const next = { ...style, ...change }
    setStyle(next)
    engineRef.current?.setStyle(next)
    void settingsStore.update({
      font: next.font,
      textSize: next.sizeStep,
      theme: next.theme,
    })
  }

  const offerInstall = useInstallOffer(phase === 'finished')

  const colors = THEME_COLORS[resolveTheme(style.theme, dark)]
  const percentLeft = location ? location.fraction : 0

  return (
    <div
      data-testid="reader"
      data-phase={phase}
      data-locator={location?.locator ?? ''}
      className="fixed inset-0 overflow-hidden"
      style={{ background: colors.background, color: colors.text }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (gestureRef.current = null)}
    >
      <div ref={containerRef} className="absolute inset-x-0 top-0 bottom-10" />

      {phase === 'ready' && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Previous page"
            onClick={() => turn('prev')}
            className="absolute top-0 bottom-10 left-0 w-[30%] cursor-default touch-pan-y"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show or hide controls"
            onClick={() => setBarsVisible((v) => !v)}
            className="absolute top-0 bottom-10 left-[30%] w-[40%] cursor-default touch-pan-y"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Next page"
            onClick={() => turn('next')}
            className="absolute top-0 right-0 bottom-10 w-[30%] cursor-default touch-pan-y"
          />
        </>
      )}

      {phase === 'ready' && !hintSeen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-30 flex justify-center px-4">
          <div
            role="note"
            data-testid="reader-hint"
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border border-current/30 px-4 py-3 text-sm shadow-lg"
            style={{ background: colors.background }}
          >
            <p>Tap the edges or swipe to turn pages.</p>
            <button
              type="button"
              onClick={dismissHint}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-current/40 px-3 font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {barsVisible && phase !== 'finished' && (
        <header
          className="absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-3 border-b border-current/15 px-4"
          style={{ background: colors.background }}
        >
          <Link to="/" className="text-sm underline">
            ‹ Back
          </Link>
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {entry?.title}
            {entry?.isCollection && (
              <span className="font-normal opacity-70">
                {' '}
                · from {entry.bookTitle.split(' / ')[0]}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={dogEarLabel}
            title={dogEarLabel}
            onClick={() => dogEar.toggle(id)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={dogEared ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              aria-hidden="true"
              data-testid="dog-ear-icon"
              data-filled={dogEared}
            >
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M15 3v4h4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Text and theme settings"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
            className="rounded border border-current/30 px-2.5 py-1 text-sm font-semibold"
          >
            Aa
          </button>
        </header>
      )}

      <footer
        className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center border-t border-current/15 px-4"
        style={{ background: colors.background }}
      >
        <ProgressBar
          fraction={percentLeft}
          minutesLeft={location?.minutesLeft ?? entry?.readingMinutes ?? 0}
        />
      </footer>

      {dogEar.removed && (
        <UndoToast
          key={dogEar.removed.key}
          position="bottom-14"
          onUndo={dogEar.undo}
          onExpire={dogEar.dismiss}
        />
      )}

      {panelOpen && phase !== 'finished' && (
        <div style={{ background: colors.background }}>
          <AaPanel
            style={style}
            onChange={changeStyle}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      {phase === 'finished' && entry && (
        <EndScreen
          title={entry.title}
          offerInstall={offerInstall}
          onBack={() => navigate('/')}
          onRate={(rating, reason) =>
            recordRating(eventLog, id, rating, reason).catch((error: unknown) =>
              console.error(error),
            )
          }
        />
      )}

      {phase === 'loading' && (
        <div
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center text-sm"
          style={{ background: colors.background }}
        >
          Opening…
        </div>
      )}

      {phase === 'offline' && (
        <div
          role="alert"
          data-testid="offline-message"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: colors.background }}
        >
          <p className="max-w-md text-xl font-semibold">
            This story isn’t saved for offline yet. Connect once and it will be.
          </p>
          <Link
            to="/"
            className="mt-2 inline-flex min-h-11 items-center rounded-lg border-2 border-current px-5 font-semibold"
          >
            Back to Your Shortlist
          </Link>
        </div>
      )}

      {(phase === 'missing' || phase === 'error') && (
        <div
          role="alert"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 px-6 text-center"
          style={{ background: colors.background }}
        >
          <p className="text-xl font-semibold">
            {phase === 'missing'
              ? 'We couldn’t find that story.'
              : 'Something went wrong opening this story.'}
          </p>
          {phase === 'error' && (
            <p className="max-w-md text-sm opacity-70">{errorText}</p>
          )}
          <Link to="/" className="underline">
            Back to the list
          </Link>
        </div>
      )}
    </div>
  )
}
