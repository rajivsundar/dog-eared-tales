import { useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { SeasonArt } from '../../app/seasonArt/types'
import type { WelcomeView } from './featuredStory'
import { minutesLabel } from '../detail/labels'

interface Props {
  view: WelcomeView
  /** The `h1` gets focus when the page opens. */
  headingRef: RefObject<HTMLHeadingElement | null>
  busy: boolean
  onReadNow: () => void
  onPickMoods: () => void
  /** The season's drawings, once loaded. Nothing is drawn without a season. */
  art?: SeasonArt | null
}

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The tilt of each cover in the fan, left to right. */
const FAN = [
  { rotate: '-9deg', shift: '0', z: 1 },
  { rotate: '0deg', shift: '-1.25rem', z: 3 },
  { rotate: '9deg', shift: '-1.25rem', z: 2 },
]

/** The first-run welcome: a fan of three covers, the headline, two buttons and the trust line. */
export function WelcomeHero({
  view,
  headingRef,
  busy,
  onReadNow,
  onPickMoods,
  art = null,
}: Props) {
  const { content, featured, covers } = view
  const whyId = useId()
  const [whyOpen, setWhyOpen] = useState(false)
  const whyButton = useRef<HTMLButtonElement>(null)

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative isolate mx-auto grid max-w-5xl items-center gap-8 py-4 lg:grid-cols-2 lg:gap-14 lg:py-12"
    >
      {/* Art: a fan of three real covers. Decorative, so it is hidden from screen readers. */}
      <div className="relative flex flex-col items-center">
        {/* The leaves fall only here, behind the covers and the drawing, never over the text. */}
        {art && <art.Leaves />}
        <div
          aria-hidden="true"
          data-testid="cover-fan"
          className="flex min-h-48 items-center justify-center lg:min-h-80"
        >
          {covers.map((cover, i) => (
            <img
              key={cover.id}
              src={cover.coverUrl}
              alt=""
              style={{
                transform: `rotate(${FAN[i].rotate})`,
                marginLeft: i === 0 ? 0 : FAN[i].shift,
                zIndex: FAN[i].z,
              }}
              className="h-44 w-28 rounded-lg border border-line object-cover shadow-xl sm:h-56 sm:w-36 lg:h-72 lg:w-48"
            />
          ))}
        </div>
        {art && (
          <div className="-mt-4 w-44 sm:w-56 lg:w-64">
            <art.Scene />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="relative z-10 text-center lg:text-left">
        <p className="font-serif text-lg font-bold tracking-wide text-accent">
          Twice Told
        </p>
        <h1
          id="welcome-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 font-serif text-4xl leading-tight font-bold outline-none sm:text-5xl"
        >
          {content.headline}
        </h1>
        <p className="mt-3 text-lg text-muted">{content.subline}</p>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <button
            type="button"
            className={primary}
            disabled={busy || !featured}
            onClick={onReadNow}
          >
            {content.primaryButton}
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={onPickMoods}
          >
            Pick my moods first
          </button>
        </div>
        {featured && (
          <p data-testid="featured-story" className="mt-2 text-sm text-muted">
            {featured.title} · {minutesLabel(featured.readingMinutes)}
          </p>
        )}

        <p className="mt-6 text-sm">
          Free · No account · No ads · Your reading stays on your phone
        </p>

        <div className="mt-4">
          <button
            ref={whyButton}
            type="button"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            onClick={() => setWhyOpen((open) => !open)}
            className="inline-flex min-h-11 items-center text-sm text-muted underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Why “Twice Told”?
          </button>
          <p id={whyId} hidden={!whyOpen} className="mt-1 text-sm">
            Named after Nathaniel Hawthorne’s Twice-Told Tales (1837) — stories
            worth telling again.
          </p>
        </div>
      </div>
    </section>
  )
}
