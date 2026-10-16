import type { LocationInfo } from '../../engine/reader'
import type { EventLog, ProgressStore } from '../../stores'

/** Time between page turns counts as reading time, but never more than this per turn. */
export const MAX_IDLE_SECONDS = 120

/** A "progress" event is logged each time the reader passes another tenth of the story. */
export const PROGRESS_STEPS = 10

export interface TrackerOptions {
  workId: string
  progress: Pick<ProgressStore, 'set'>
  events: Pick<EventLog, 'append'>
  /** What was saved last time, if anything. */
  startFraction?: number
  startSeconds?: number
  hadProgress?: boolean
  now?: () => number
}

export interface ProgressTracker {
  /** Logs an "open" event. */
  opened(): Promise<void>
  /** Call on every page turn. Saves the position. */
  location(location: LocationInfo): Promise<void>
  /** Call when the story ends. Saves 100% and logs a "finished" event. */
  finished(): Promise<void>
  /** Resolves when everything queued so far has been written. */
  idle(): Promise<void>
}

/** Saves the reading position and logs reading events. Writes happen one after another, in order. */
export function createProgressTracker(
  options: TrackerOptions,
): ProgressTracker {
  const { workId, progress, events } = options
  const now = options.now ?? Date.now
  let seconds = options.startSeconds ?? 0
  let lastTurnAt: number | null = null
  let lastLocator = ''
  let milestone = Math.floor((options.startFraction ?? 0) * PROGRESS_STEPS)
  let hasProgress = options.hadProgress ?? false
  let queue: Promise<unknown> = Promise.resolve()

  const enqueue = (task: () => Promise<unknown>): Promise<void> => {
    queue = queue.then(task).catch((error: unknown) => {
      console.error('could not save reading progress', error)
    })
    return queue.then(() => undefined)
  }

  const countTime = (): number => {
    const t = now()
    if (lastTurnAt !== null)
      seconds += Math.min((t - lastTurnAt) / 1000, MAX_IDLE_SECONDS)
    lastTurnAt = t
    return Math.round(seconds)
  }

  return {
    opened: () => enqueue(() => events.append({ workId, type: 'open' })),

    location(location) {
      const secondsRead = countTime()
      lastLocator = location.locator
      // Opening a story for the first time is not reading progress yet.
      if (!hasProgress && location.atStart && location.fraction === 0)
        return Promise.resolve()
      hasProgress = true
      return enqueue(async () => {
        await progress.set({
          workId,
          locator: location.locator,
          percent: Math.round(location.fraction * 1000) / 10,
          secondsRead,
        })
        const reached = Math.floor(location.fraction * PROGRESS_STEPS)
        if (reached > milestone) {
          milestone = reached
          await events.append({
            workId,
            type: 'progress',
            value: location.fraction,
          })
        }
      })
    },

    finished() {
      const secondsRead = countTime()
      hasProgress = true
      return enqueue(async () => {
        await progress.set({
          workId,
          locator: lastLocator,
          percent: 100,
          secondsRead,
        })
        await events.append({ workId, type: 'finished', value: 1 })
      })
    },

    idle: () => queue.then(() => undefined),
  }
}
