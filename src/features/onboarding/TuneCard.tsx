import { Link } from 'react-router'

/** "Tune your picks": shown at the top of Your Shortlist after the first finished story. */
export function TuneCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="tune-title"
      data-testid="tune-card"
      className="mt-6 flex items-start gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="min-w-0 flex-1">
        <h2 id="tune-title" className="font-serif text-xl font-bold">
          Tune your picks
        </h2>
        <p className="mt-1 text-sm text-muted">
          React to 8 short cards so your shortlist fits you better.
        </p>
        <Link
          to="/tune"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Tune now
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss Tune your picks"
        onClick={onDismiss}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-xl text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ×
      </button>
    </section>
  )
}
