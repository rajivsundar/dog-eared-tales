import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LocationInfo,
  OpenOptions,
  ReaderStyle,
} from '../../engine/reader'
import ReaderScreen from './ReaderScreen'

// ---------------------------------------------------------------- stand-ins for the engine, stores and catalog
const h = vi.hoisted(() => {
  const failOpen = { value: false }
  class FakeEngine {
    open = vi.fn<(url: string, options?: OpenOptions) => Promise<void>>(
      async () => {
        if (failOpen.value) throw new Error('the book file is damaged')
      },
    )
    next = vi.fn(async () => {})
    prev = vi.fn(async () => {})
    goTo = vi.fn(async () => {})
    setStyle = vi.fn<(style: ReaderStyle) => void>()
    close = vi.fn()
    locationCallbacks: Array<(l: LocationInfo) => void> = []
    endCallbacks: Array<() => void> = []
    onLocation(cb: (l: LocationInfo) => void) {
      this.locationCallbacks.push(cb)
      return () => {}
    }
    onRangeEnd(cb: () => void) {
      this.endCallbacks.push(cb)
      return () => {}
    }
  }
  return {
    failOpen,
    FakeEngine,
    engines: [] as InstanceType<typeof FakeEngine>[],
    progressStore: { get: vi.fn(), set: vi.fn(async (p: unknown) => p) },
    eventLog: { append: vi.fn(async (e: unknown) => e) },
    libraryStore: {
      list: vi.fn(async () => [] as unknown[]),
      get: vi.fn(),
      save: vi.fn(async (id: string) => ({ workId: id })),
      remove: vi.fn(async () => {}),
    },
    settingsStore: {
      get: vi.fn(),
      update: vi.fn(async (c: unknown) => c),
    },
  }
})

vi.mock('../../engine/reader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine/reader')>()
  return {
    ...actual,
    createReaderEngine: () => {
      const engine = new h.FakeEngine()
      h.engines.push(engine)
      return engine
    },
  }
})
vi.mock('../../stores', () => ({
  progressStore: h.progressStore,
  eventLog: h.eventLog,
  settingsStore: h.settingsStore,
  libraryStore: h.libraryStore,
}))

const entry = {
  id: 'pg-1661-a-scandal-in-bohemia',
  title: 'A Scandal in Bohemia',
  bookTitle: 'The Adventures of Sherlock Holmes',
  isCollection: true,
  textUrl: '/texts/pg-1661.epub',
  startHref: 'OEBPS/x_1661-h-1.htm.xhtml#pgepubid00002',
  endHref: 'OEBPS/x_1661-h-2.htm.xhtml#pgepubid00006',
  readingMinutes: 37,
}
vi.mock('../../catalog', () => ({
  getEntry: vi.fn(async (id: string) => (id === entry.id ? entry : undefined)),
}))

const SETTINGS = {
  id: 'settings',
  theme: 'paper',
  font: 'literata',
  textSize: 5,
  mix: 'default',
  aiPrefs: {},
  contentFilters: {},
}

function loc(fraction: number, over: Partial<LocationInfo> = {}): LocationInfo {
  return {
    locator: `cfi-${Math.round(fraction * 100)}`,
    fraction,
    wordsLeft: 500,
    minutesLeft: 3,
    atStart: false,
    atEnd: false,
    ...over,
  }
}

async function open(path = `/read/${entry.id}`) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>HOME PAGE</p>} />
        <Route path="/read/:id" element={<ReaderScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() => expect(h.engines).toHaveLength(1))
  const engine = h.engines[0]
  await waitFor(() =>
    expect(screen.getByTestId('reader')).toHaveAttribute('data-phase', 'ready'),
  )
  return engine
}

beforeEach(() => {
  h.libraryStore.list.mockResolvedValue([])
  h.libraryStore.get.mockResolvedValue(undefined)
  h.engines.length = 0
  h.failOpen.value = false
  vi.clearAllMocks()
  h.progressStore.get.mockResolvedValue(undefined)
  h.settingsStore.get.mockResolvedValue({ ...SETTINGS })
})

describe('opening a story', () => {
  it('opens the entry’s text through the engine with the story range and saved style', async () => {
    const engine = await open()
    expect(engine.open).toHaveBeenCalledWith(entry.textUrl, {
      startHref: entry.startHref,
      endHref: entry.endHref,
      locator: undefined,
    })
    expect(engine.setStyle).toHaveBeenCalledWith({
      font: 'literata',
      sizeStep: 5,
      theme: 'paper',
    })
    expect(h.eventLog.append).toHaveBeenCalledWith({
      workId: entry.id,
      type: 'open',
    })
    expect(screen.getByText(/A Scandal in Bohemia/)).toBeInTheDocument()
  })

  it('reopens where the reader left off', async () => {
    h.progressStore.get.mockResolvedValue({
      workId: entry.id,
      locator: 'cfi-saved',
      percent: 42,
      secondsRead: 300,
      updatedAt: 1,
    })
    const engine = await open()
    expect(engine.open).toHaveBeenCalledWith(
      entry.textUrl,
      expect.objectContaining({ locator: 'cfi-saved' }),
    )
  })

  it('starts a finished story again from the beginning', async () => {
    h.progressStore.get.mockResolvedValue({
      workId: entry.id,
      locator: 'cfi-end',
      percent: 100,
      secondsRead: 900,
      updatedAt: 1,
    })
    const engine = await open()
    expect(engine.open).toHaveBeenCalledWith(
      entry.textUrl,
      expect.objectContaining({ locator: undefined }),
    )
  })

  it('says so when the story is not in the catalog', async () => {
    render(
      <MemoryRouter initialEntries={['/read/nope']}>
        <Routes>
          <Route path="/read/:id" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t find that story.',
    )
  })

  it('shows what went wrong if the engine cannot open the story', async () => {
    h.failOpen.value = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={[`/read/${entry.id}`]}>
        <Routes>
          <Route path="/read/:id" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong opening this story.')
    expect(alert).toHaveTextContent('the book file is damaged')
    error.mockRestore()
  })
})

describe('turning pages', () => {
  it('turns with the tap zones', async () => {
    const engine = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(engine.next).toHaveBeenCalledTimes(1)
    expect(engine.prev).toHaveBeenCalledTimes(1)
  })

  it('turns with the arrow keys, Page Up/Down and Space', async () => {
    const engine = await open()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'PageDown' })
    fireEvent.keyDown(window, { key: ' ' })
    expect(engine.next).toHaveBeenCalledTimes(3)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'PageUp' })
    expect(engine.prev).toHaveBeenCalledTimes(2)
  })

  it('hides and shows the controls when the middle is tapped', async () => {
    await open()
    expect(
      screen.getByRole('button', { name: 'Text and theme settings' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show or hide controls' }),
    )
    expect(
      screen.queryByRole('button', { name: 'Text and theme settings' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show or hide controls' }),
    )
    expect(
      screen.getByRole('button', { name: 'Text and theme settings' }),
    ).toBeInTheDocument()
  })
})

describe('progress', () => {
  it('shows progress and minutes left, and saves the position on every turn', async () => {
    const engine = await open()
    act(() => engine.locationCallbacks[0](loc(0.25, { minutesLeft: 28 })))
    expect(
      screen.getByRole('progressbar', { name: 'Progress through this story' }),
    ).toHaveAttribute('aria-valuenow', '25')
    expect(screen.getByTestId('minutes-left')).toHaveTextContent(
      '28 min left in this story',
    )
    await waitFor(() =>
      expect(h.progressStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          workId: entry.id,
          locator: 'cfi-25',
          percent: 25,
        }),
      ),
    )
    act(() => engine.locationCallbacks[0](loc(0.3)))
    await waitFor(() => expect(h.progressStore.set).toHaveBeenCalledTimes(2))
  })

  it('logs a progress event at each tenth', async () => {
    const engine = await open()
    act(() => engine.locationCallbacks[0](loc(0.05)))
    act(() => engine.locationCallbacks[0](loc(0.12)))
    await waitFor(() =>
      expect(h.eventLog.append).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'progress', workId: entry.id }),
      ),
    )
  })
})

describe('the Aa panel', () => {
  it('applies a change at once, saves it, and does not reopen the story', async () => {
    const engine = await open()
    fireEvent.click(
      screen.getByRole('button', { name: 'Text and theme settings' }),
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }))
    expect(engine.setStyle).toHaveBeenLastCalledWith({
      font: 'literata',
      sizeStep: 5,
      theme: 'night',
    })
    expect(h.settingsStore.update).toHaveBeenCalledWith({
      font: 'literata',
      textSize: 5,
      theme: 'night',
    })
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } })
    expect(engine.setStyle).toHaveBeenLastCalledWith({
      font: 'literata',
      sizeStep: 8,
      theme: 'night',
    })
    fireEvent.click(
      screen.getByRole('radio', { name: 'Atkinson Hyperlegible' }),
    )
    expect(h.settingsStore.update).toHaveBeenLastCalledWith({
      font: 'atkinson',
      textSize: 8,
      theme: 'night',
    })
    expect(engine.open).toHaveBeenCalledTimes(1)
    expect(h.engines).toHaveLength(1)
  })

  it('does not turn pages with the arrow keys while it is open', async () => {
    const engine = await open()
    fireEvent.click(
      screen.getByRole('button', { name: 'Text and theme settings' }),
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(engine.next).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.queryByRole('dialog', { name: 'Text and theme settings' }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(engine.next).toHaveBeenCalledTimes(1)
  })
})

describe('finishing', () => {
  it('shows the end screen, logs finished, and goes back from the button', async () => {
    const engine = await open()
    act(() => engine.locationCallbacks[0](loc(0.99, { atEnd: true })))
    act(() => engine.endCallbacks[0]())
    const end = await screen.findByTestId('end-screen')
    expect(end).toHaveTextContent('A Scandal in Bohemia')
    expect(end).toHaveTextContent('You finished it')
    await waitFor(() =>
      expect(h.eventLog.append).toHaveBeenCalledWith({
        workId: entry.id,
        type: 'finished',
        value: 1,
      }),
    )
    expect(h.progressStore.set).toHaveBeenLastCalledWith(
      expect.objectContaining({ percent: 100 }),
    )

    // More "next" presses on the last page must not log it again, or turn anything.
    act(() => engine.endCallbacks[0]())
    expect(
      h.eventLog.append.mock.calls.filter(
        ([e]) => (e as { type: string }).type === 'finished',
      ),
    ).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to Your Shortlist' }),
    )
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument()
  })

  it('closes the engine when the screen is left', async () => {
    const engine = await open()
    fireEvent.click(screen.getByText('‹ Back'))
    expect(engine.close).toHaveBeenCalled()
  })
})

describe('the dog-ear button', () => {
  const saved = {
    workId: entry.id,
    shelf: 'default',
    addedAt: 1000,
    offline: false,
  }

  it('is in the top bar with a tooltip and keeps the reading position', async () => {
    const engine = await open()
    act(() => engine.locationCallbacks.forEach((cb) => cb(loc(0.3))))
    const reader = screen.getByTestId('reader')
    const place = reader.getAttribute('data-locator')
    await waitFor(() => expect(h.progressStore.set).toHaveBeenCalled())
    const saves = h.progressStore.set.mock.calls.length

    const button = screen.getByRole('button', { name: 'Dog-ear it for later' })
    expect(button).toHaveAttribute('title', 'Dog-ear it for later')
    expect(screen.getByTestId('dog-ear-icon')).toHaveAttribute(
      'data-filled',
      'false',
    )
    await act(async () => {
      fireEvent.click(button)
    })

    expect(h.eventLog.append).toHaveBeenCalledWith({
      workId: entry.id,
      type: 'save',
    })
    expect(h.libraryStore.save).toHaveBeenCalledWith(entry.id)
    const filled = screen.getByRole('button', { name: 'Dog-eared' })
    expect(filled).toHaveAttribute('title', 'Dog-eared')
    expect(screen.getByTestId('dog-ear-icon')).toHaveAttribute(
      'data-filled',
      'true',
    )
    // The page did not turn and the position did not change.
    expect(engine.next).not.toHaveBeenCalled()
    expect(engine.prev).not.toHaveBeenCalled()
    expect(reader.getAttribute('data-locator')).toBe(place)
    expect(h.progressStore.set.mock.calls.length).toBe(saves)
  })

  it('starts filled for a dog-eared story, and toggling off shows Removed · Undo', async () => {
    h.libraryStore.list.mockResolvedValue([saved])
    h.libraryStore.get.mockResolvedValue(saved)
    await open()
    const filled = await screen.findByRole('button', { name: 'Dog-eared' })
    await act(async () => {
      fireEvent.click(filled)
    })
    expect(h.eventLog.append).toHaveBeenCalledWith({
      workId: entry.id,
      type: 'unsave',
    })
    expect(h.libraryStore.remove).toHaveBeenCalledWith(entry.id)
    expect(screen.getByRole('status')).toHaveTextContent('Removed ·')
    expect(
      screen.getByRole('button', { name: 'Dog-ear it for later' }),
    ).toBeVisible()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(h.libraryStore.save).toHaveBeenCalledWith(entry.id, {
      shelf: 'default',
      offline: false,
      addedAt: 1000,
    })
    expect(h.eventLog.append).toHaveBeenCalledWith({
      workId: entry.id,
      type: 'undo',
      reason: 'unsave',
    })
    expect(screen.getByRole('button', { name: 'Dog-eared' })).toBeVisible()
  })
})

describe('the check-in', () => {
  async function finish() {
    const engine = await open()
    act(() => engine.locationCallbacks[0](loc(0.99, { atEnd: true })))
    act(() => engine.endCallbacks[0]())
    return screen.findByTestId('end-screen')
  }
  const rated = () =>
    h.eventLog.append.mock.calls
      .map(([e]) => e as { type: string; reason?: string })
      .filter((e) => ['love', 'ok', 'notForMe'].includes(e.type))

  it('offers Loved it, It was OK and Not for me on the end screen', async () => {
    const end = await finish()
    for (const name of ['Loved it', 'It was OK', 'Not for me']) {
      expect(within(end).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(rated()).toHaveLength(0)
  })

  it('records Loved it for the work', async () => {
    const end = await finish()
    await act(async () => {
      fireEvent.click(within(end).getByRole('button', { name: 'Loved it' }))
    })
    expect(h.eventLog.append).toHaveBeenCalledWith({
      workId: entry.id,
      type: 'love',
    })
    expect(within(end).getByTestId('check-in-done')).toHaveTextContent(
      'Loved it',
    )
    // It was finished too.
    expect(
      h.eventLog.append.mock.calls.filter(
        ([e]) => (e as { type: string }).type === 'finished',
      ),
    ).toHaveLength(1)
  })

  it('Not for me offers the reasons, and records the one chosen', async () => {
    const end = await finish()
    fireEvent.click(within(end).getByRole('button', { name: 'Not for me' }))
    for (const name of [
      'Too long',
      'Not my genre',
      'Too old-fashioned',
      'Too dark',
      'Already read',
    ]) {
      expect(within(end).getByRole('button', { name })).toBeInTheDocument()
    }
    await act(async () => {
      fireEvent.click(within(end).getByRole('button', { name: 'Too long' }))
    })
    expect(rated()).toEqual([
      { workId: entry.id, type: 'notForMe', reason: 'too-long' },
    ])
  })

  it('the reason is optional: Skip still records Not for me', async () => {
    const end = await finish()
    fireEvent.click(within(end).getByRole('button', { name: 'Not for me' }))
    await act(async () => {
      fireEvent.click(within(end).getByRole('button', { name: 'Skip' }))
    })
    expect(rated()).toEqual([{ workId: entry.id, type: 'notForMe' }])
  })
})
