import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSeasonArt } from '../../app/seasonArt/useSeasonArt'
import { welcomeContent } from '../../app/seasons'
import { type CatalogEntry, loadCatalog } from '../../catalog'
import { type CardAnswer, pickTasteCards } from '../../engine/recommend'
import { eventLog, profileStore, settingsStore } from '../../stores'
import { finishOnboarding, startWithStory } from './finishOnboarding'
import { type WelcomeView, welcomeView } from './featuredStory'
import { MAX_MOODS, MIN_MOODS, MOODS, READING_TIMES, ladderFor } from './moods'
import { TasteCards } from './TasteCards'
import { WelcomeHero } from './WelcomeHero'

type Step = 'welcome' | 'mood' | 'cards' | 'context'

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/**
 * Onboarding at /welcome.
 * First run: the welcome page, then either "Read a short story now" (straight into the reader) or
 * the mood board and Your Shortlist.
 * "Redo onboarding" (/welcome?redo=1, from Settings) runs the full flow: moods, taste cards and
 * reading context.
 */
export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const full = params.get('redo') === '1'
  // A preview (from Settings → About) shows the welcome screen and changes nothing.
  const preview = params.get('preview') === '1'
  const [seasonal, setSeasonal] = useState(true)

  const [step, setStep] = useState<Step>(full ? 'mood' : 'welcome')
  const [now] = useState(() => new Date())
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [moods, setMoods] = useState<string[]>([])
  const [cards, setCards] = useState<Record<string, CardAnswer>>({})
  const [tasteCards, setTasteCards] = useState<CatalogEntry[]>([])
  const [times, setTimes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list)
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
    let cancelled = false
    settingsStore
      .get()
      .then((s) => {
        if (!cancelled) setSeasonal(s.seasonalThemes !== false)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Each step moves focus to its heading, so a screen reader announces where you are.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const content = welcomeContent(now, undefined, seasonal)
  const art = useSeasonArt(content.art)
  const view: WelcomeView = catalog
    ? welcomeView(content, catalog)
    : { content, featured: undefined, covers: [] }

  const fail = (error: unknown): void => {
    console.error(error)
    setBusy(false)
    setFailed(true)
  }

  /** "Read a short story now": an empty profile (so this page never returns), then the reader. */
  const readNow = (): void => {
    if (!view.featured || busy) return
    setBusy(true)
    startWithStory({ profile: profileStore })
      .then(() => navigate(`/read/${view.featured!.id}`, { replace: true }))
      .catch(fail)
  }

  const finish = (answers: {
    moods: string[]
    cards: Record<string, CardAnswer>
    ladderLevel?: number
  }): void => {
    if (!catalog || busy) return
    setBusy(true)
    finishOnboarding(
      {
        catalog,
        events: eventLog,
        profile: profileStore,
        settings: settingsStore,
      },
      answers,
    )
      .then(() => navigate('/', { replace: true }))
      .catch(fail)
  }

  // The cards are chosen when the reader arrives at the step, from the moods picked by then.
  const goToCards = (picked: string[]): void => {
    setMoods(picked)
    setTasteCards(catalog ? pickTasteCards(catalog, picked) : [])
    setStep('cards')
  }

  const toggleMood = (id: string): void => {
    setMoods((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : prev.length < MAX_MOODS
          ? [...prev, id]
          : prev,
    )
  }

  const heading = (id: string, text: string): ReactNode => (
    <h2
      id={id}
      ref={headingRef}
      tabIndex={-1}
      className="font-serif text-2xl font-bold outline-none sm:text-3xl"
    >
      {text}
    </h2>
  )

  return (
    <main className="mx-auto max-w-5xl px-gutter py-8 sm:py-12">
      {failed && (
        <p role="alert" className="mb-4">
          Something went wrong. Please try again.
        </p>
      )}

      {preview && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-3"
        >
          <span>Preview of the welcome screen. Nothing is saved.</span>
          <Link to="/settings" className={secondary}>
            Back to Settings
          </Link>
        </div>
      )}

      {step === 'welcome' && (
        <WelcomeHero
          view={view}
          art={art}
          headingRef={headingRef}
          busy={busy || preview}
          onReadNow={readNow}
          onPickMoods={() => setStep('mood')}
        />
      )}

      {step === 'mood' && (
        <section aria-labelledby="mood-title" className="mx-auto max-w-3xl">
          {heading('mood-title', 'What are you in the mood for?')}
          <p className="mt-2 text-muted">
            Pick {MIN_MOODS} to {MAX_MOODS} moods.
          </p>
          <div
            role="group"
            aria-labelledby="mood-title"
            className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {MOODS.map((mood) => {
              const selected = moods.includes(mood.id)
              return (
                <button
                  key={mood.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && moods.length >= MAX_MOODS}
                  onClick={() => toggleMood(mood.id)}
                  className={`flex min-h-14 items-center gap-3 rounded-card border-2 px-3 text-left text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-accent bg-accent/10 font-semibold'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-6 shrink-0 rounded-full border border-ink/20"
                    style={{ background: mood.color }}
                  />
                  <span className="flex-1">{mood.label}</span>
                  {selected && <span aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-3 text-sm text-muted">
            {moods.length} of {MAX_MOODS} picked
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={secondary}
              onClick={() =>
                full ? navigate('/settings') : setStep('welcome')
              }
            >
              Back
            </button>
            <button
              type="button"
              className={primary}
              disabled={!catalog || busy || moods.length < MIN_MOODS}
              aria-describedby={
                moods.length < MIN_MOODS ? 'mood-hint' : undefined
              }
              onClick={() =>
                full ? goToCards(moods) : finish({ moods, cards: {} })
              }
            >
              {full ? 'Next' : 'Show my shortlist'}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={!catalog || busy}
              onClick={() =>
                full ? goToCards([]) : finish({ moods: [], cards: {} })
              }
            >
              Skip
            </button>
          </div>
          {moods.length < MIN_MOODS && (
            <p id="mood-hint" className="mt-2 text-sm text-muted">
              Pick at least {MIN_MOODS} moods to continue, or skip to see a
              balanced mix.
            </p>
          )}
        </section>
      )}

      {step === 'cards' && (
        <section aria-labelledby="cards-title" className="mx-auto max-w-3xl">
          {heading('cards-title', 'Which of these catch your eye?')}
          <p className="mt-2 text-muted">
            Judge each by its first line. You can leave any unanswered.
          </p>
          {!catalog && !failed && <p className="mt-4 text-muted">Loading…</p>}
          <TasteCards
            cards={tasteCards}
            answers={cards}
            onAnswer={(id, answer) =>
              setCards((prev) => ({ ...prev, [id]: answer }))
            }
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={secondary}
              onClick={() => setStep('mood')}
            >
              Back
            </button>
            <button
              type="button"
              className={primary}
              onClick={() => setStep('context')}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 'context' && (
        <section aria-labelledby="context-title" className="mx-auto max-w-3xl">
          {heading('context-title', 'When do you usually read?')}
          <p className="mt-2 text-muted">
            Optional. Pick any that fit. It sets how long your first stories
            are.
          </p>
          <fieldset className="mt-5">
            <legend className="sr-only">When do you usually read?</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {READING_TIMES.map((time) => (
                <label key={time.id}>
                  <input
                    type="checkbox"
                    value={time.id}
                    checked={times.includes(time.id)}
                    onChange={() =>
                      setTimes((prev) =>
                        prev.includes(time.id)
                          ? prev.filter((t) => t !== time.id)
                          : [...prev, time.id],
                      )
                    }
                    className="peer sr-only"
                  />
                  <span className="flex min-h-14 cursor-pointer items-center rounded-card border-2 border-line bg-surface px-4 text-base peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                    {time.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={secondary}
              onClick={() => setStep('cards')}
            >
              Back
            </button>
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={() =>
                finish({ moods, cards, ladderLevel: ladderFor(times) })
              }
            >
              {busy ? 'Setting up…' : 'Show me my shortlist'}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => finish({ moods, cards })}
            >
              Skip
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
