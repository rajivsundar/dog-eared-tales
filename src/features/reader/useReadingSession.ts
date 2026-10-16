import { useCallback, useEffect, useRef } from 'react'
import { eventLog } from '../../stores'
import { type SessionTracker, createSessionTracker } from './sessionTracker'

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

/**
 * Records a `session` event (active seconds) when the reader closes, the tab is hidden, or the
 * reader navigates away. Returns a function to call on every page turn.
 */
export function useReadingSession(workId: string): () => void {
  const trackerRef = useRef<SessionTracker | null>(null)

  useEffect(() => {
    const tracker = createSessionTracker({ workId, events: eventLog })
    trackerRef.current = tracker
    tracker.start()

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') void tracker.flush()
      else tracker.start()
    }
    const onHide = (): void => void tracker.flush()
    const onActivity = (): void => tracker.activity()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, {
        capture: true,
        passive: true,
      })
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true })
      }
      void tracker.flush()
      trackerRef.current = null
    }
  }, [workId])

  return useCallback(() => trackerRef.current?.activity(), [])
}
