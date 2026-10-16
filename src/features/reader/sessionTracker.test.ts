import { describe, expect, it, vi } from 'vitest'
import {
  IDLE_MS,
  MIN_SESSION_SECONDS,
  createSessionTracker,
} from './sessionTracker'

const SECOND = 1000
const MINUTE = 60 * SECOND

function setup() {
  let t = 1_000_000
  const append = vi.fn(async (e: unknown) => e)
  const events = { append } as never
  const tracker = createSessionTracker({
    workId: 'w1',
    events,
    now: () => t,
  })
  return {
    tracker,
    append,
    wait: (ms: number) => {
      t += ms
    },
  }
}

const sessions = (append: ReturnType<typeof setup>['append']) =>
  append.mock.calls.map(([e]) => e as { type: string; value: number })

describe('session tracker', () => {
  it('records the active seconds when the session ends', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(60 * SECOND)
    tracker.activity()
    wait(60 * SECOND)
    await tracker.flush()
    expect(append).toHaveBeenCalledWith({
      workId: 'w1',
      type: 'session',
      value: 120,
    })
  })

  it('pauses after 3 minutes with no page turn, scroll or tap', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(60 * SECOND)
    tracker.activity() // 1 minute of reading
    wait(10 * MINUTE) // walked away
    tracker.activity() // came back: only 3 of those 10 minutes count
    wait(30 * SECOND)
    await tracker.flush()
    expect(sessions(append)).toEqual([
      { workId: 'w1', type: 'session', value: 60 + 180 + 30 },
    ])
  })

  it('counts at most 3 minutes after the last activity even if the tab closes much later', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(2 * SECOND)
    tracker.activity()
    wait(2 * 60 * MINUTE) // left the page open for two hours
    await tracker.flush()
    expect(sessions(append)[0].value).toBe(2 + IDLE_MS / SECOND)
  })

  it('ignores sessions under 30 seconds', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait((MIN_SESSION_SECONDS - 1) * SECOND)
    await tracker.flush()
    expect(append).not.toHaveBeenCalled()
  })

  it('keeps a session of exactly 30 seconds', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(MIN_SESSION_SECONDS * SECOND)
    await tracker.flush()
    expect(sessions(append)).toEqual([
      { workId: 'w1', type: 'session', value: 30 },
    ])
  })

  it('records a session once however many times it is flushed', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(90 * SECOND)
    await tracker.flush()
    await tracker.flush()
    expect(append).toHaveBeenCalledTimes(1)
  })

  it('starts a new session after a flush (the tab shown again)', async () => {
    const { tracker, append, wait } = setup()
    tracker.start()
    wait(60 * SECOND)
    await tracker.flush() // tab hidden
    wait(5 * MINUTE) // away: not counted
    tracker.start() // tab visible again
    wait(45 * SECOND)
    await tracker.flush()
    expect(sessions(append).map((s) => s.value)).toEqual([60, 45])
  })

  it('treats activity with no session running as the start of one', async () => {
    const { tracker, append, wait } = setup()
    tracker.activity()
    wait(40 * SECOND)
    await tracker.flush()
    expect(sessions(append)[0].value).toBe(40)
  })

  it('does not throw if saving fails', async () => {
    let now = 0
    const failing = createSessionTracker({
      workId: 'w1',
      events: {
        append: vi.fn(async () => {
          throw new Error('disk full')
        }),
      } as never,
      now: () => now,
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    failing.start()
    now += 60 * SECOND
    await expect(failing.flush()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
