import type { EventLog } from '../../stores'

export type Rating = 'love' | 'ok' | 'notForMe'

/** Records Loved it, It was OK or Not for me (with an optional reason) for a work. */
export async function recordRating(
  events: Pick<EventLog, 'append'>,
  workId: string,
  rating: Rating,
  reason?: string,
): Promise<void> {
  await events.append(
    reason ? { workId, type: rating, reason } : { workId, type: rating },
  )
}

export const RATING_LABELS: Record<Rating, string> = {
  love: 'Loved it',
  ok: 'It was OK',
  notForMe: 'Not for me',
}
