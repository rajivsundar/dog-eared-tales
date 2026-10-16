import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type CatalogEntry, loadCatalog } from '../../catalog'
import { type CardAnswer, pickTasteCards } from '../../engine/recommend'
import { eventLog, profileStore, settingsStore } from '../../stores'
import { pickedMoods, tuneTaste } from './finishOnboarding'
import { TasteCards } from './TasteCards'

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** /tune: the taste cards, reached from "Tune your picks". Saving rebuilds today's shortlist at once. */
export default function TuneScreen() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [cards, setCards] = useState<CatalogEntry[]>([])
  const [answers, setAnswers] = useState<Record<string, CardAnswer>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCatalog(), eventLog.list()])
      .then(([list, events]) => {
        if (cancelled) return
        setCatalog(list)
        // From the moods picked earlier, or the balanced mix if there were none.
        setCards(pickTasteCards(list, pickedMoods(events)))
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const save = (): void => {
    if (!catalog || busy) return
    setBusy(true)
    tuneTaste(
      {
        catalog,
        events: eventLog,
        profile: profileStore,
        settings: settingsStore,
      },
      answers,
    )
      .then(() => navigate('/', { replace: true }))
      .catch((error: unknown) => {
        console.error(error)
        setBusy(false)
        setFailed(true)
      })
  }

  return (
    <main className="mx-auto max-w-3xl px-gutter py-8 sm:py-12">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-2xl font-bold outline-none sm:text-3xl"
      >
        Tune your picks
      </h1>
      <p className="mt-2 text-muted">
        Judge each by its first line. You can leave any unanswered.
      </p>
      {failed && (
        <p role="alert" className="mt-4">
          Something went wrong. Please try again.
        </p>
      )}
      {!catalog && !failed && <p className="mt-4 text-muted">Loading…</p>}
      <TasteCards
        cards={cards}
        answers={answers}
        onAnswer={(id, answer) =>
          setAnswers((prev) => ({ ...prev, [id]: answer }))
        }
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primary}
          disabled={busy || !catalog}
          onClick={save}
        >
          {busy ? 'Updating…' : 'Update my picks'}
        </button>
        <Link to="/" className={secondary}>
          Not now
        </Link>
      </div>
    </main>
  )
}
