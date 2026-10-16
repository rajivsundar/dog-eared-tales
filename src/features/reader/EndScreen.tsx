import { InstallControl } from '../../pwa/InstallControl'
import { CheckIn } from '../checkin/CheckIn'
import type { Rating } from '../checkin/rating'

export interface EndScreenProps {
  title: string
  onBack: () => void
  /** Called with the reader's check-in answer. */
  onRate: (rating: Rating, reason?: string) => void | Promise<void>
  /** Offer to install the app: shown once, after the first finished story. */
  offerInstall?: boolean
}

/** Shown when the reader reaches the end of the story, with the check-in. */
export function EndScreen({
  title,
  onBack,
  onRate,
  offerInstall = false,
}: EndScreenProps) {
  return (
    <div
      role="dialog"
      aria-label="Story finished"
      data-testid="end-screen"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-inherit px-6 py-6 text-center"
    >
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-xl">You finished it</p>
      <CheckIn onRate={onRate} />
      {offerInstall && (
        <div
          data-testid="install-offer"
          className="mt-2 flex max-w-sm flex-col items-center gap-2 text-sm"
        >
          <p>Keep Twice Told on your device, and read offline.</p>
          <InstallControl />
        </div>
      )}
      <button
        type="button"
        onClick={onBack}
        className="mt-4 min-h-11 rounded-lg border-2 border-current px-5 py-2.5 text-base font-semibold"
      >
        Back to Your Shortlist
      </button>
    </div>
  )
}
