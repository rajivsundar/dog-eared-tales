import type { ReaderEvent } from '../../stores'

/** What the event log says about each story. */
export interface History {
  finished: Set<string>
  notForMe: Set<string>
  /** Stories the reader has opened, dog-eared or tapped, even if not finished. */
  touched: Set<string>
  /** How many times each story has ever been shown. */
  timesShown: Map<string, number>
  /** How many times each story has been shown since the reader last tapped it. */
  shownSinceTap: Map<string, number>
}

const TAPS = new Set<ReaderEvent['type']>(['tap', 'open', 'save'])

export function digestEvents(events: ReaderEvent[]): History {
  const history: History = {
    finished: new Set(),
    notForMe: new Set(),
    touched: new Set(),
    timesShown: new Map(),
    shownSinceTap: new Map(),
  }
  const inOrder = [...events].sort((a, b) => a.at - b.at)
  for (const event of inOrder) {
    const id = event.workId
    if (event.type === 'shown') {
      history.timesShown.set(id, (history.timesShown.get(id) ?? 0) + 1)
      history.shownSinceTap.set(id, (history.shownSinceTap.get(id) ?? 0) + 1)
    } else if (TAPS.has(event.type)) {
      history.touched.add(id)
      history.shownSinceTap.set(id, 0)
    } else if (event.type === 'finished') {
      history.finished.add(id)
    } else if (event.type === 'notForMe') {
      history.notForMe.add(id)
    } else if (event.type === 'undo' && event.reason !== 'unsave') {
      // Undo cancels the not-for-me before it. (An undo of an un-dog-ear says reason: 'unsave'.)
      history.notForMe.delete(id)
    }
  }
  return history
}
