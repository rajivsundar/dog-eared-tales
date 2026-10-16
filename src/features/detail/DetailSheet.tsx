import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import type { CatalogEntry } from '../../catalog'
import {
  bookName,
  lengthLabel,
  minutesLabel,
  readingLevelLabel,
} from './labels'

interface Props {
  entry: CatalogEntry
  reason: string
  dogEared: boolean
  onClose: () => void
  onDogEar: () => void
  onNotForMe: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled])'

const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-full px-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The detail sheet: a bottom sheet on a phone and a centred panel on a wide screen. */
export function DetailSheet({
  entry,
  reason,
  dogEared,
  onClose,
  onDogEar,
  onNotForMe,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Focus moves into the sheet and goes back to the card when it closes. Tab stays inside.
  useEffect(() => {
    const before = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement) before.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        data-testid="detail-sheet"
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface text-ink shadow-xl sm:rounded-2xl"
      >
        <div className="overflow-y-auto px-gutter pt-5 pb-4">
          <div className="flex gap-4">
            <img
              src={entry.coverUrl}
              alt={`Cover of ${entry.title}`}
              className="h-36 w-24 shrink-0 rounded-md border border-line object-cover"
            />
            <div className="min-w-0">
              <h2
                id="sheet-title"
                className="font-serif text-2xl leading-tight font-bold"
              >
                {entry.title}
              </h2>
              <p className="mt-1 text-base">{entry.author}</p>
              <p className="mt-1 text-sm text-muted">
                {entry.year}
                {entry.isCollection && ` · from ${bookName(entry)}`}
              </p>
              <p className="mt-2 text-sm font-medium text-accent">{reason}</p>
            </div>
          </div>

          <p className="mt-4 font-serif text-lg leading-snug">{entry.hook}</p>
          <p className="mt-2 text-base leading-relaxed">{entry.blurb}</p>

          <figure className="mt-4 border-l-4 border-accent pl-3">
            <figcaption className="text-xs font-semibold tracking-wide text-muted uppercase">
              First line
            </figcaption>
            <blockquote className="mt-1 font-serif text-base italic">
              {entry.firstLine}
            </blockquote>
          </figure>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Reading time</dt>
            <dd>{minutesLabel(entry.readingMinutes)}</dd>
            <dt className="text-muted">Length</dt>
            <dd>{lengthLabel(entry.lengthClass)}</dd>
            <dt className="text-muted">Reading level</dt>
            <dd>{readingLevelLabel(entry.readingLevel)}</dd>
            <dt className="text-muted">Moods</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {entry.moods.map((mood) => (
                  <li
                    key={mood}
                    className="rounded-full border border-line px-2.5 py-0.5"
                  >
                    {mood}
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="text-muted">Content notes</dt>
            <dd data-testid="content-notes">
              {entry.contentNotes.length > 0
                ? entry.contentNotes.join(', ')
                : 'None noted'}
            </dd>
            <dt className="text-muted">Source</dt>
            <dd>
              {entry.source} ·{' '}
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View on Project Gutenberg
              </a>
              <span className="block text-muted">{entry.license}</span>
            </dd>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-gutter py-3">
          <Link
            to={`/read/${entry.id}`}
            className={`${buttonBase} bg-accent text-accent-ink`}
          >
            Read now
          </Link>
          <button
            type="button"
            title={dogEared ? 'Dog-eared' : 'Dog-ear it for later'}
            onClick={onDogEar}
            className={`${buttonBase} border border-line ${dogEared ? 'bg-line/40' : ''}`}
          >
            {dogEared ? 'Dog-eared' : 'Dog-ear'}
          </button>
          <button
            type="button"
            onClick={onNotForMe}
            className={`${buttonBase} text-muted underline`}
          >
            Not for me
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${buttonBase} ml-auto text-muted`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
