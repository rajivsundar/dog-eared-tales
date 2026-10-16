import { sittingsLabel } from '../../engine/recommend'
import { minutesLabel } from '../detail/labels'
import type { ShortlistPick } from './dailyShortlist'

interface Props {
  picks: ShortlistPick[]
  /** The reader's usual sitting, in minutes. */
  sitting: number
  onOpen: (workId: string) => void
}

/** Your Long List: longer works (novelettes and novellas), shown below Your Shortlist. */
export function LongListSection({ picks, sitting, onOpen }: Props) {
  return (
    <section aria-labelledby="long-list-title" className="mt-10">
      <h2
        id="long-list-title"
        className="font-serif text-2xl font-bold sm:text-3xl"
      >
        Your Long List
      </h2>
      <p className="mt-1 text-muted">Longer reads, for when you are ready.</p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <span className="mt-1 text-sm text-muted">
                  {minutesLabel(entry.readingMinutes)} ·{' '}
                  {sittingsLabel(entry.readingMinutes, sitting)}
                </span>
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
