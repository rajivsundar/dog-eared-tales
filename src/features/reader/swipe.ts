// Turns a finished touch gesture into a page turn, or nothing.

/** Swipes that start this close to a screen edge are left to the system (Android uses them for Back). */
export const EDGE_PX = 24
/** The least a swipe must travel sideways. */
export const MIN_SWIPE_PX = 48
/** A swipe must be at least this many times wider than it is tall, so a mostly vertical swipe does nothing. */
export const HORIZONTAL_RATIO = 2
/** Slower drags are not swipes. */
export const MAX_SWIPE_MS = 800

export interface Gesture {
  startX: number
  startY: number
  endX: number
  endY: number
  ms: number
  screenWidth: number
}

/** A swipe left turns to the next page, a swipe right to the previous one. */
export function swipeDirection(g: Gesture): 'next' | 'prev' | null {
  if (g.startX < EDGE_PX || g.startX > g.screenWidth - EDGE_PX) return null
  if (g.ms > MAX_SWIPE_MS) return null
  const dx = g.endX - g.startX
  const dy = g.endY - g.startY
  if (Math.abs(dx) < MIN_SWIPE_PX) return null
  if (Math.abs(dx) < HORIZONTAL_RATIO * Math.abs(dy)) return null
  return dx < 0 ? 'next' : 'prev'
}
