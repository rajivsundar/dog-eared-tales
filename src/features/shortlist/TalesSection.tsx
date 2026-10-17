import { minutesLabel } from '../detail/labels'
import { OfflineBadge } from '../offline/OfflineBadge'
import type { ShortlistPick } from './dailyShortlist'

interface Props {
  title: string
  picks: ShortlistPick[]
  cached: ReadonlySet<string>
  onOpen: (workId: string) => void
}

/** The seasonal row on Your Shortlist (Tales for Longer Nights). Each card shows its content notes. */
export function TalesSection({ title, picks, cached, onOpen }: Props) {
  return (
    <section aria-labelledby="tales-title" className="mt-10">
      <h2
        id="tales-title"
        className="font-serif text-2xl font-bold sm:text-3xl"
      >
        {title}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map(({ entry, reason }) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onOpen(entry.id)}
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
                {entry.contentNotes.length > 0 && (
                  <span className="mt-1 text-sm text-muted">
                    Content notes: {entry.contentNotes.join(', ')}
                  </span>
                )}
                <span className="mt-auto pt-2 text-sm font-medium text-accent">
                  {reason}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
