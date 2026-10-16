export interface EndScreenProps {
  title: string
  onBack: () => void
}

/** Shown when the reader reaches the end of the story. The check-in comes in a later phase. */
export function EndScreen({ title, onBack }: EndScreenProps) {
  return (
    <div
      role="dialog"
      aria-label="Story finished"
      data-testid="end-screen"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-inherit px-6 text-center"
    >
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-xl">You finished it</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 rounded-lg border-2 border-current px-5 py-2.5 text-base font-semibold"
      >
        Back to Your Shortlist
      </button>
    </div>
  )
}
