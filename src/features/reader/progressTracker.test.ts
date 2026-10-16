import { describe, expect, it, vi } from 'vitest'
import type { LocationInfo } from '../../engine/reader'
import { MAX_IDLE_SECONDS, createProgressTracker } from './progressTracker'

function loc(fraction: number, over: Partial<LocationInfo> = {}): LocationInfo {
  return {
    locator: `cfi-${Math.round(fraction * 100)}`,
    fraction,
    wordsLeft: 100,
    minutesLeft: 1,
    atStart: fraction === 0,
    atEnd: fraction >= 1,
    ...over,
  }
}

function setup(
  options: Partial<Parameters<typeof createProgressTracker>[0]> = {},
) {
  const progress = { set: vi.fn(async (p) => ({ ...p, updatedAt: 1 })) }
  const events = { append: vi.fn(async (e) => ({ ...e, id: 'x', at: 1 })) }
  let time = 1_000_000
  const tracker = createProgressTracker({
    workId: 'pg-1-story',
    progress,
    events,
    now: () => time,
    ...options,
  })
  return {
    tracker,
    progress,
    events,
    advance: (seconds: number) => (time += seconds * 1000),
  }
}

describe('opening', () => {
  it('logs an open event', async () => {
    const { tracker, events } = setup()
    await tracker.opened()
    expect(events.append).toHaveBeenCalledWith({
      workId: 'pg-1-story',
      type: 'open',
    })
  })
})

describe('saving the position', () => {
  it('saves on every page turn', async () => {
    const { tracker, progress, advance } = setup({ hadProgress: true })
    await tracker.location(loc(0.12))
    advance(30)
    await tracker.location(loc(0.13))
    expect(progress.set).toHaveBeenCalledTimes(2)
    expect(progress.set).toHaveBeenLastCalledWith({
      workId: 'pg-1-story',
      locator: 'cfi-13',
      percent: 13,
      secondsRead: 30,
    })
  })

  it('does not save the very first page of a story nobody has read yet', async () => {
    const { tracker, progress } = setup()
    await tracker.location(loc(0, { atStart: true }))
    expect(progress.set).not.toHaveBeenCalled()
  })

  it('saves once the reader has moved on from the first page', async () => {
    const { tracker, progress } = setup()
    await tracker.location(loc(0, { atStart: true }))
    await tracker.location(loc(0.05, { atStart: false }))
    expect(progress.set).toHaveBeenCalledTimes(1)
  })

  it('counts time between turns, but not more than two minutes per turn', async () => {
    const { tracker, progress, advance } = setup({
      hadProgress: true,
      startSeconds: 100,
    })
    await tracker.location(loc(0.2))
    advance(45)
    await tracker.location(loc(0.21))
    advance(3600) // left the screen open for an hour
    await tracker.location(loc(0.22))
    const last = progress.set.mock.calls.at(-1)![0]
    expect(last.secondsRead).toBe(100 + 45 + MAX_IDLE_SECONDS)
  })
})

describe('progress events', () => {
  it('logs one each time the reader passes another tenth', async () => {
    const { tracker, events } = setup({ hadProgress: true })
    for (const f of [0.05, 0.12, 0.15, 0.31, 0.32, 0.55])
      await tracker.location(loc(f))
    const logged = events.append.mock.calls.map(([e]) => [
      e.type,
      Math.floor(e.value * 10),
    ])
    expect(logged).toEqual([
      ['progress', 1],
      ['progress', 3],
      ['progress', 5],
    ])
  })

  it('does not log the same tenth again after reopening part-way', async () => {
    const { tracker, events } = setup({
      hadProgress: true,
      startFraction: 0.42,
    })
    await tracker.location(loc(0.43))
    await tracker.location(loc(0.52))
    expect(events.append).toHaveBeenCalledTimes(1)
    expect(events.append.mock.calls[0][0].value).toBeCloseTo(0.52)
  })
})

describe('finishing', () => {
  it('saves 100% at the last position and logs a finished event', async () => {
    const { tracker, progress, events } = setup({ hadProgress: true })
    await tracker.location(loc(0.99, { atEnd: true }))
    await tracker.finished()
    expect(progress.set).toHaveBeenLastCalledWith(
      expect.objectContaining({ percent: 100, locator: 'cfi-99' }),
    )
    expect(events.append).toHaveBeenLastCalledWith({
      workId: 'pg-1-story',
      type: 'finished',
      value: 1,
    })
  })
})

describe('writing in order', () => {
  it('waits for each write before the next, and keeps going after a failure', async () => {
    const order: string[] = []
    const progress = {
      set: vi.fn(async (p: { percent: number }) => {
        await new Promise((r) => setTimeout(r, p.percent === 10 ? 20 : 0))
        order.push(`set ${p.percent}`)
        if (p.percent === 10) throw new Error('disk full')
        return { ...p, workId: 'w', locator: '', secondsRead: 0, updatedAt: 1 }
      }),
    }
    const events = {
      append: vi.fn(async () => ({
        id: 'x',
        at: 1,
        workId: 'w',
        type: 'progress' as const,
      })),
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tracker = createProgressTracker({
      workId: 'w',
      progress,
      events,
      hadProgress: true,
    })
    void tracker.location(loc(0.1))
    void tracker.location(loc(0.2))
    await tracker.idle()
    expect(order).toEqual(['set 10', 'set 20'])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
