import { MIN_SESSION_SECONDS } from '../../engine/recommend'
import type { EventLog } from '../../stores'

export { MIN_SESSION_SECONDS }

/** After this long with no page turn, scroll or tap, the clock stops until the next one. */
export const IDLE_MS = 3 * 60 * 1000

export interface SessionTrackerOptions {
  workId: string
  events: Pick<EventLog, 'append'>
  now?: () => number
}

export interface SessionTracker {
  /** Starts a session if none is running (opening the reader, or the tab becoming visible). */
  start(): void
  /** Call on every page turn, scroll or tap. */
  activity(): void
  /** Ends the session and records a `session` event with the active seconds, if long enough. */
  flush(): Promise<void>
}

/**
 * Counts active reading time. After each page turn, scroll or tap, up to 3 minutes count; time
 * after that, with no activity, does not. Sessions under 30 seconds are not recorded.
 */
export function createSessionTracker(
  options: SessionTrackerOptions,
): SessionTracker {
  const { workId, events } = options
  const now = options.now ?? Date.now
  let running = false
  let last = 0
  let activeMs = 0

  const credit = (t: number): void => {
    activeMs += Math.min(Math.max(0, t - last), IDLE_MS)
    last = t
  }

  const tracker: SessionTracker = {
    start() {
      const t = now()
      if (running) {
        credit(t)
        return
      }
      running = true
      last = t
      activeMs = 0
    },
    activity() {
      if (!running) tracker.start()
      else credit(now())
    },
    async flush() {
      if (!running) return
      credit(now())
      running = false
      const seconds = Math.round(activeMs / 1000)
      activeMs = 0
      if (seconds < MIN_SESSION_SECONDS) return
      try {
        await events.append({ workId, type: 'session', value: seconds })
      } catch (error) {
        console.error('could not save the reading session', error)
      }
    },
  }
  return tracker
}
