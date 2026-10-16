import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registers the service worker, and when a new version is ready shows "New version available ·
 * Update". The page only reloads when the reader taps Update.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-gutter top-3 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-ink py-1 pr-1 pl-5 text-page shadow-lg"
    >
      <span>New version available ·</span>
      <span className="flex items-center">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 min-w-11 rounded-full px-3 font-semibold underline"
        >
          Update
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setNeedRefresh(false)}
          className="min-h-11 min-w-11 rounded-full px-3 text-lg"
        >
          ×
        </button>
      </span>
    </div>
  )
}
