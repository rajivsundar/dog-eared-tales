import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { type CatalogEntry, loadCatalog } from '../../catalog'
import { type CardAnswer, pickTasteCards } from '../../engine/recommend'
import { eventLog, profileStore, settingsStore } from '../../stores'
import { minutesLabel } from '../detail/labels'
import { finishOnboarding } from './finishOnboarding'
import { MAX_MOODS, MIN_MOODS, MOODS, READING_TIMES, ladderFor } from './moods'

type Step = 'welcome' | 'mood' | 'cards' | 'context'

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const linkButton =
  'inline-flex min-h-11 items-center px-2 text-sm text-muted underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const CARD_CHOICES: { value: CardAnswer; label: string }[] = [
  { value: 'love', label: 'Love' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'notForMe', label: 'Not for me' },
]

/** First-run onboarding at /welcome: welcome, mood board, taste cards, reading context. */
export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
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

  // Each step moves focus to its heading, so a screen reader announces where you are.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  // The cards are chosen when the reader arrives at the step, from the moods picked by then.
  const goToCards = (picked: string[]): void => {
    setMoods(picked)
    setTasteCards(catalog ? pickTasteCards(catalog, picked) : [])
    setStep('cards')
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
      .catch((error: unknown) => {
        console.error(error)
        setBusy(false)
        setFailed(true)
      })
  }

  const skipSetup = (): void => finish({ moods: [], cards: {} })

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
    <main className="mx-auto max-w-3xl px-gutter py-8 sm:py-12">
      {failed && (
        <p role="alert" className="mb-4">
          Something went wrong. Please try again.
        </p>
      )}

      {step === 'welcome' && (
        <section aria-labelledby="welcome-title" className="text-center">
          <h1
            id="welcome-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-10 font-serif text-4xl font-bold outline-none sm:text-5xl"
          >
            Twice Told
          </h1>
          <p className="mt-4 text-lg text-muted">
            Great free stories, picked for you. Start short. Fall for the
            classics.
          </p>
          <p className="mt-6">Your reading data stays on this device</p>
          <button
            type="button"
            className={`${primary} mt-8`}
            onClick={() => setStep('mood')}
          >
            Find my first story
          </button>
        </section>
      )}

      {step === 'mood' && (
        <section aria-labelledby="mood-title">
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
              onClick={() => setStep('welcome')}
            >
              Back
            </button>
            <button
              type="button"
              className={primary}
              aria-describedby={
                moods.length < MIN_MOODS ? 'mood-hint' : undefined
              }
              disabled={!catalog || moods.length < MIN_MOODS}
              onClick={() => goToCards(moods)}
            >
              Next
            </button>
            <button
              type="button"
              className={secondary}
              disabled={!catalog}
              onClick={() => goToCards([])}
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
          <button
            type="button"
            className={`${linkButton} mt-4`}
            onClick={skipSetup}
          >
            Skip setup
          </button>
        </section>
      )}

      {step === 'cards' && (
        <section aria-labelledby="cards-title">
          {heading('cards-title', 'Which of these catch your eye?')}
          <p className="mt-2 text-muted">
            Judge each by its first line. You can leave any unanswered.
          </p>
          {!catalog && !failed && <p className="mt-4 text-muted">Loading…</p>}
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tasteCards.map((entry) => (
              <li key={entry.id}>
                <fieldset className="flex h-full flex-col rounded-card border border-line bg-surface p-3">
                  <legend className="sr-only">
                    Your reaction to {entry.title}
                  </legend>
                  <div className="flex gap-3">
                    <img
                      src={entry.coverUrl}
                      alt=""
                      className="h-28 w-[4.5rem] shrink-0 rounded-md border border-line object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-serif text-lg leading-snug font-bold">
                        {entry.title}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {minutesLabel(entry.readingMinutes)}
                      </p>
                      <blockquote className="mt-2 font-serif text-sm italic">
                        {entry.firstLine}
                      </blockquote>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CARD_CHOICES.map((choice) => (
                      <label key={choice.value} className="flex-1">
                        <input
                          type="radio"
                          name={`card-${entry.id}`}
                          value={choice.value}
                          checked={cards[entry.id] === choice.value}
                          onChange={() =>
                            setCards((prev) => ({
                              ...prev,
                              [entry.id]: choice.value,
                            }))
                          }
                          className="peer sr-only"
                        />
                        <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line px-3 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                          {choice.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
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
            <button type="button" className={linkButton} onClick={skipSetup}>
              Skip setup
            </button>
          </div>
        </section>
      )}

      {step === 'context' && (
        <section aria-labelledby="context-title">
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
