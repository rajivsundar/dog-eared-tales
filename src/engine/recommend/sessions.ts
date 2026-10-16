import type { ReaderEvent } from '../../stores'

/** Until there are this many real sessions, a sitting is the default length. */
export const MIN_SESSIONS_FOR_MEDIAN = 3
export const DEFAULT_SITTING_MINUTES = 15
/** The sitting is the median of this many of the latest sessions. */
export const SESSIONS_TO_AVERAGE = 10
/** A session shorter than this is not a real one. */
export const MIN_SESSION_SECONDS = 30

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The reader's usual sitting in minutes, rounded to the nearest 5 (never below 5). */
export function sittingMinutes(events: ReaderEvent[]): number {
  const sessions = events
    .filter(
      (e) =>
        e.type === 'session' &&
        typeof e.value === 'number' &&
        e.value >= MIN_SESSION_SECONDS,
    )
    .sort((a, b) => a.at - b.at)
    .slice(-SESSIONS_TO_AVERAGE)
  if (sessions.length < MIN_SESSIONS_FOR_MEDIAN) return DEFAULT_SITTING_MINUTES
  const minutes = median(sessions.map((s) => s.value as number)) / 60
  return Math.max(5, Math.round(minutes / 5) * 5)
}

/** How many sittings a work of this length takes. */
export function sittingsFor(totalMinutes: number, sitting: number): number {
  return Math.max(1, Math.ceil(totalMinutes / sitting))
}

/** "About 4 sittings of 15 min". */
export function sittingsLabel(totalMinutes: number, sitting: number): string {
  const n = sittingsFor(totalMinutes, sitting)
  return `About ${n} ${n === 1 ? 'sitting' : 'sittings'} of ${sitting} min`
}
