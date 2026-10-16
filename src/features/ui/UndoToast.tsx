import { useEffect, useRef } from 'react'

export const TOAST_MS = 5000

interface Props {
  /** Tailwind class for the distance from the bottom. The default clears the bottom navigation. */
  position?: string
  onUndo: () => void
  /** Called after 5 seconds, when the message goes away without an undo. */
  onExpire: () => void
}

/**
 * The "Removed · Undo" message. It sits above the bottom navigation and goes away after 5 seconds.
 * Give it a new `key` for each removal so the 5 seconds start again.
 */
export function UndoToast({
  onUndo,
  onExpire,
  position = 'bottom-[calc(var(--nav-height)+0.75rem)]',
}: Props) {
  const expire = useRef(onExpire)
  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])
  useEffect(() => {
    const timer = setTimeout(() => expire.current(), TOAST_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      className={`fixed inset-x-gutter ${position} z-30 mx-auto flex max-w-sm items-center justify-between gap-4 rounded-full bg-ink py-1 pr-2 pl-5 text-page shadow-lg`}
    >
      <span>Removed ·</span>
      <button
        type="button"
        onClick={onUndo}
        className="min-h-11 min-w-11 rounded-full px-3 font-semibold underline"
      >
        Undo
      </button>
    </div>
  )
}
