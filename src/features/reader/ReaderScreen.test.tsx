import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LocationInfo,
  OpenOptions,
  ReaderStyle,
} from '../../engine/reader'
import { setDeferredPromptForTest } from '../../pwa/install'
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
    eventLog: {
      append: vi.fn(async (e: unknown) => e),
      list: vi.fn(async () => [] as unknown[]),
    },
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
    profileManager: {
      getPersistence: vi.fn(async () => undefined),
      setPersistence: vi.fn(async () => {}),
      current: () => ({ mode: 'profile' }),
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
  profileManager: h.profileManager,
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
  h.eventLog.list.mockResolvedValue([])
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

describe('reading sessions', () => {
  const START = new Date(2026, 9, 16, 10, 0, 0).getTime()
  let visibility = 'visible'
  const sessionEvents = () =>
    h.eventLog.append.mock.calls
      .map(([e]) => e as { workId: string; type: string; value?: number })
      .filter((e) => e.type === 'session')
  const later = (seconds: number) =>
    vi.setSystemTime(Date.now() + seconds * 1000)
  const setVisibility = (state: 'hidden' | 'visible') => {
    visibility = state
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)
  })
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('saves the session when the tab is hidden', async () => {
    await open()
    later(90)
    setVisibility('hidden')
    await waitFor(() =>
      expect(sessionEvents()).toEqual([
        { workId: entry.id, type: 'session', value: 90 },
      ]),
    )
  })

  it('starts a new session when the tab is shown again', async () => {
    await open()
    later(60)
    setVisibility('hidden')
    later(600) // away
    setVisibility('visible')
    later(45)
    setVisibility('hidden')
    await waitFor(() =>
      expect(sessionEvents().map((s) => s.value)).toEqual([60, 45]),
    )
  })

  it('saves the session when the page is hidden (pagehide)', async () => {
    await open()
    later(120)
    window.dispatchEvent(new Event('pagehide'))
    await waitFor(() =>
      expect(sessionEvents().map((s) => s.value)).toEqual([120]),
    )
  })

  it('saves the session when the reader navigates away', async () => {
    await open()
    later(75)
    fireEvent.click(screen.getByText('‹ Back'))
    await waitFor(() =>
      expect(sessionEvents().map((s) => s.value)).toEqual([75]),
    )
  })

  it('ignores a session under 30 seconds', async () => {
    await open()
    later(20)
    setVisibility('hidden')
    fireEvent.click(screen.getByText('‹ Back'))
    await Promise.resolve()
    expect(sessionEvents()).toEqual([])
  })

  it('pauses after 3 minutes without a page turn, and a page turn counts as activity', async () => {
    const engine = await open()
    later(30)
    act(() => engine.locationCallbacks.forEach((cb) => cb(loc(0.2))))
    later(20 * 60) // 20 minutes on one page
    act(() => engine.locationCallbacks.forEach((cb) => cb(loc(0.3))))
    later(10)
    setVisibility('hidden')
    // 30 s + 3 min of the long wait + 10 s.
    await waitFor(() =>
      expect(sessionEvents().map((s) => s.value)).toEqual([30 + 180 + 10]),
    )
  })

  it('counts a tap or a scroll as activity too', async () => {
    await open()
    later(30)
    window.dispatchEvent(new Event('pointerdown'))
    later(15 * 60)
    window.dispatchEvent(new Event('scroll'))
    later(5)
    setVisibility('hidden')
    await waitFor(() =>
      expect(sessionEvents().map((s) => s.value)).toEqual([30 + 180 + 5]),
    )
  })
})

describe('opening a book that is not stored while offline', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows a friendly message and a Back to Your Shortlist button, not the error page', async () => {
    h.failOpen.value = true
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(
      <MemoryRouter initialEntries={[`/read/${entry.id}`]}>
        <Routes>
          <Route path="/" element={<p>HOME PAGE</p>} />
          <Route path="/read/:id" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    const message = await screen.findByTestId('offline-message')
    expect(message).toHaveTextContent(
      'This story isn’t saved for offline yet. Connect once and it will be.',
    )
    expect(screen.getByTestId('reader')).toHaveAttribute(
      'data-phase',
      'offline',
    )
    expect(
      screen.queryByText('Something went wrong opening this story.'),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('link', { name: 'Back to Your Shortlist' }),
    )
    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument()
  })

  it('still shows the error page for a failure while online', async () => {
    h.failOpen.value = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={[`/read/${entry.id}`]}>
        <Routes>
          <Route path="/read/:id" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(
      await screen.findByText('Something went wrong opening this story.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('offline-message')).not.toBeInTheDocument()
    error.mockRestore()
  })
})

describe('the install offer and asking to protect the data', () => {
  const finishedEvent = (workId: string) => ({
    id: workId,
    workId,
    type: 'finished',
    at: 1,
  })
  const promptEvent = () => {
    const e = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: string }>
    }
    e.prompt = vi.fn(async () => {})
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    return e
  }
  const environment = (standalone: boolean, userAgent?: string) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(display-mode: standalone)' && standalone,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    if (userAgent) {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: userAgent,
      })
    }
  }
  const finish = async () => {
    const engine = await open()
    act(() => engine.locationCallbacks[0](loc(0.99, { atEnd: true })))
    act(() => engine.endCallbacks[0]())
    return screen.findByTestId('end-screen')
  }

  beforeEach(() => {
    setDeferredPromptForTest(null)
    environment(false)
    h.eventLog.list.mockResolvedValue([finishedEvent(entry.id)])
  })
  afterEach(() => {
    setDeferredPromptForTest(null)
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'userAgent')
    Reflect.deleteProperty(navigator, 'storage')
  })

  it('offers the install once, gently, on the end screen after the first finished story', async () => {
    setDeferredPromptForTest(promptEvent())
    const end = await finish()
    const offer = await within(end).findByTestId('install-offer')
    expect(
      within(offer).getByRole('button', { name: 'Install Dog-Eared Tales' }),
    ).toBeInTheDocument()
    expect(h.settingsStore.update).toHaveBeenCalledWith({
      installOffered: true,
    })
  })

  it('never offers it when the app is already installed (standalone)', async () => {
    environment(true)
    setDeferredPromptForTest(promptEvent())
    const end = await finish()
    await act(async () => {})
    expect(within(end).queryByTestId('install-offer')).not.toBeInTheDocument()
    expect(h.settingsStore.update).not.toHaveBeenCalledWith({
      installOffered: true,
    })
  })

  it('does not offer it a second time', async () => {
    h.settingsStore.get.mockResolvedValue({ ...SETTINGS, installOffered: true })
    setDeferredPromptForTest(promptEvent())
    const end = await finish()
    await act(async () => {})
    expect(within(end).queryByTestId('install-offer')).not.toBeInTheDocument()
  })

  it('does not offer it after a later finished story (only the first)', async () => {
    h.eventLog.list.mockResolvedValue([
      finishedEvent('another-story'),
      finishedEvent(entry.id),
    ])
    setDeferredPromptForTest(promptEvent())
    const end = await finish()
    await act(async () => {})
    expect(within(end).queryByTestId('install-offer')).not.toBeInTheDocument()
  })

  it('shows Share → Add to Home Screen steps on iPhone Safari', async () => {
    environment(
      false,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    const end = await finish()
    const offer = await within(end).findByTestId('install-offer')
    expect(within(offer).getByTestId('ios-install')).toHaveTextContent(
      'Add to Home Screen',
    )
  })

  it('asks the browser to protect the data after the first finished story, once', async () => {
    const persist = vi.fn(async () => true)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })
    await finish()
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
    expect(h.profileManager.setPersistence).toHaveBeenCalledWith({
      requested: true,
      granted: true,
    })
  })

  it('asks after the first Dog-ear too', async () => {
    const persist = vi.fn(async () => true)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })
    h.eventLog.list.mockResolvedValue([
      { id: 's', workId: entry.id, type: 'save', at: 1 },
    ])
    await open()
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Dog-ear it for later' }),
      )
    })
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
  })
})
