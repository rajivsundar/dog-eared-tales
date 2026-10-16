import { useState } from 'react'
import { NOT_FOR_ME_REASONS } from '../../engine/recommend'
import { RATING_LABELS, type Rating } from './rating'

interface Props {
  /** Called once with the rating (and the reason, for Not for me). */
  onRate: (rating: Rating, reason?: string) => void | Promise<void>
}

const button =
  'inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-current px-4 py-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'

/**
 * The check-in: Loved it, It was OK or Not for me. Not for me then offers an optional reason.
 * Its colours follow the text colour around it, so it works in the reader's themes and the app's.
 */
export function CheckIn({ onRate }: Props) {
  const [step, setStep] = useState<'choose' | 'reason' | 'done'>('choose')
  const [said, setSaid] = useState<Rating | null>(null)

  const finish = (rating: Rating, reason?: string): void => {
    setSaid(rating)
    setStep('done')
    void onRate(rating, reason)
  }

  if (step === 'done' && said) {
    return (
      <p role="status" data-testid="check-in-done" className="text-lg">
        Thanks. Noted: {RATING_LABELS[said]}.
      </p>
    )
  }

  if (step === 'reason') {
    return (
      <div
        data-testid="check-in-reason"
        className="flex flex-col items-center gap-3"
      >
        <p className="text-lg">Why not? (optional)</p>
        <div className="flex flex-wrap justify-center gap-2">
          {NOT_FOR_ME_REASONS.map((reason) => (
            <button
              key={reason.id}
              type="button"
              className={button}
              onClick={() => finish('notForMe', reason.id)}
            >
              {reason.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="min-h-11 px-3 underline"
          onClick={() => finish('notForMe')}
        >
          Skip
        </button>
      </div>
    )
  }

  return (
    <div data-testid="check-in" className="flex flex-col items-center gap-3">
      <p className="text-lg">How was it?</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={button} onClick={() => finish('love')}>
          {RATING_LABELS.love}
        </button>
        <button type="button" className={button} onClick={() => finish('ok')}>
          {RATING_LABELS.ok}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => setStep('reason')}
        >
          {RATING_LABELS.notForMe}
        </button>
      </div>
    </div>
  )
}
