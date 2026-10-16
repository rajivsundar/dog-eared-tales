import type { CatalogEntry } from '../../catalog'
import type { CardAnswer } from '../../engine/recommend'
import { minutesLabel } from '../detail/labels'

const CARD_CHOICES: { value: CardAnswer; label: string }[] = [
  { value: 'love', label: 'Love' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'notForMe', label: 'Not for me' },
]

interface Props {
  cards: CatalogEntry[]
  answers: Record<string, CardAnswer>
  onAnswer: (workId: string, answer: CardAnswer) => void
}

/** The taste cards: a real work each, with its cover, minutes and genuine first line, and three answers. */
export function TasteCards({ cards, answers, onAnswer }: Props) {
  return (
    <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((entry) => (
        <li key={entry.id}>
          <fieldset className="flex h-full flex-col rounded-card border border-line bg-surface p-3">
            <legend className="sr-only">Your reaction to {entry.title}</legend>
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
                    checked={answers[entry.id] === choice.value}
                    onChange={() => onAnswer(entry.id, choice.value)}
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
  )
}
