/** A small "Available offline" icon: a tick in a circle. Shows nothing if the book is not stored. */
export function OfflineBadge({
  available,
  withLabel = false,
}: {
  available: boolean
  /** Also write "Available offline" next to the icon (the detail sheet does). */
  withLabel?: boolean
}) {
  if (!available) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-accent"
      {...(withLabel
        ? {}
        : {
            role: 'img',
            'aria-label': 'Available offline',
            title: 'Available offline',
          })}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        data-testid="offline-icon"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </svg>
      {withLabel && <span className="text-sm">Available offline</span>}
    </span>
  )
}
