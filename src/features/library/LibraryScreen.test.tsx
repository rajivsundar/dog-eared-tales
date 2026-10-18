import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCacheStorage } from '../../pwa/fakeCaches'
import { TEXTS_CACHE } from '../../pwa/textCache'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import LibraryScreen from './LibraryScreen'

const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('../shortlist/fakeStores').fakeStores
  >,
}))
vi.mock('../../stores', async () => {
  const { delegateManager } = await import('../shortlist/fakeStores')
  const delegate = (name: string) =>
    new Proxy(
      {},
      {
        get:
          (_, method: string) =>
          (...args: unknown[]) =>
            (
              h.current as unknown as Record<
                string,
                Record<string, (...a: unknown[]) => unknown>
              >
            )[name][method](...args),
      },
    )
  return {
    profileManager: delegateManager(() => h.current),
    eventLog: delegate('eventLog'),
    libraryStore: delegate('libraryStore'),
    progressStore: delegate('progressStore'),
    settingsStore: delegate('settingsStore'),
  }
})

let stores: ReturnType<typeof fakeStores>

function renderLibrary(path = '/library') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LibraryScreen />
    </MemoryRouter>,
  )
}

const tab = (name: string) =>
  screen.getByRole('tab', { name: new RegExp(name) })

beforeEach(() => {
  stores = fakeStores()
  h.current = stores
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        entries: fakeCatalog().map((e) => ({ ...e, wordCount: 2380 })),
      }),
    })),
  )
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('empty states', () => {
  it.each([
    ['reading', /Nothing in progress yet/],
    ['dog-eared', /Nothing kept yet/],
    ['finished', /No finished stories yet/],
  ])('the %s tab says so and links to Your Shortlist', async (id, text) => {
    renderLibrary(`/library?tab=${id}`)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Go to Your Shortlist' }),
    ).toHaveAttribute('href', '/')
  })
})

describe('tabs', () => {
  it('starts on Reading and shows a story with a progress bar and minutes left', async () => {
    await stores.progressStore.set({
      workId: 'story-3',
      locator: 'x',
      percent: 50,
      secondsRead: 10,
    })
    renderLibrary()
    expect(await screen.findByText('Story 3')).toBeInTheDocument()
    expect(tab('Reading')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('5 min left')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(screen.getByRole('link', { name: /Story 3/ })).toHaveAttribute(
      'href',
      '/read/story-3',
    )
  })

  it('switches tabs and with the arrow keys', async () => {
    await stores.libraryStore.save('story-4')
    renderLibrary()
    await screen.findByText(/Nothing in progress yet/)
    fireEvent.keyDown(tab('Reading'), { key: 'ArrowRight' })
    expect(await screen.findByText('Story 4')).toBeInTheDocument()
    expect(tab('Kept')).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the finish date on Finished', async () => {
    await stores.eventLog.append({
      workId: 'story-2',
      type: 'finished',
      at: new Date(2026, 9, 14, 12).getTime(),
    })
    renderLibrary('/library?tab=finished')
    expect(await screen.findByText('Story 2')).toBeInTheDocument()
    expect(screen.getByText(/Finished .*2026/)).toBeInTheDocument()
  })

  it('keeps an opened but unread work under Dog-eared', async () => {
    await stores.libraryStore.save('story-1')
    await stores.eventLog.append({ workId: 'story-1', type: 'open' })
    renderLibrary()
    await screen.findByText(/Nothing in progress yet/)
    fireEvent.click(tab('Kept'))
    expect(await screen.findByText('Story 1')).toBeInTheDocument()
  })

  it('moves a dog-eared work to Reading after a page is turned', async () => {
    await stores.libraryStore.save('story-1')
    await stores.progressStore.set({
      workId: 'story-1',
      locator: 'x',
      percent: 12,
      secondsRead: 30,
    })
    renderLibrary()
    expect(await screen.findByText('Story 1')).toBeInTheDocument()
    fireEvent.click(tab('Kept'))
    expect(await screen.findByText(/Nothing kept yet/)).toBeInTheDocument()
  })
})

describe('un-dog-ear', () => {
  async function setup() {
    await stores.libraryStore.save('story-1', { addedAt: 1000 })
    await stores.libraryStore.save('story-2', { addedAt: 2000 })
    renderLibrary('/library?tab=dog-eared')
    await screen.findByText('Story 2')
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Un-dog-ear Story 2' }),
      )
    })
  }

  it('removes the card, records unsave and shows Removed · Undo', async () => {
    await setup()
    expect(screen.queryByText('Story 2')).not.toBeInTheDocument()
    expect(screen.getByText('Story 1')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Removed ·')
    expect(stores.events.filter((e) => e.type === 'unsave')).toEqual([
      expect.objectContaining({ workId: 'story-2' }),
    ])
    expect(stores.library.has('story-2')).toBe(false)
  })

  it('Undo puts the work back with its date and records an undo of the unsave', async () => {
    await setup()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(await screen.findByText('Story 2')).toBeInTheDocument()
    expect(stores.library.get('story-2')?.addedAt).toBe(2000)
    expect(stores.events.filter((e) => e.type === 'undo')).toEqual([
      expect.objectContaining({ workId: 'story-2', reason: 'unsave' }),
    ])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // Newest first, as before.
    const titles = within(screen.getByRole('tabpanel'))
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(titles[0]).toContain('Story 2')
  })

  it('the message goes away after 5 seconds', async () => {
    await setup()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(stores.library.has('story-2')).toBe(false)
  })
})

describe('Rate it', () => {
  const finishedAt = new Date(2026, 9, 14, 12).getTime()

  it('shows Rate it on a finished work with no rating, and opens the check-in', async () => {
    await stores.eventLog.append({
      workId: 'story-2',
      type: 'finished',
      at: finishedAt,
    })
    renderLibrary('/library?tab=finished')
    await screen.findByText('Story 2')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rate Story 2' }))
    })
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Loved it' }))
    })
    expect(stores.events.filter((e) => e.type === 'love')).toEqual([
      expect.objectContaining({ workId: 'story-2' }),
    ])
    // Once rated, the button is gone and the rating shows.
    expect(
      await screen.findByText(/Loved it$/, { selector: 'span' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rate Story 2' }),
    ).not.toBeInTheDocument()
  })

  it('does not show Rate it on a work that already has a rating', async () => {
    await stores.eventLog.append({
      workId: 'story-2',
      type: 'finished',
      at: finishedAt,
    })
    await stores.eventLog.append({
      workId: 'story-2',
      type: 'ok',
      at: finishedAt + 1,
    })
    renderLibrary('/library?tab=finished')
    await screen.findByText('Story 2')
    expect(
      screen.queryByRole('button', { name: /^Rate / }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/It was OK/)).toBeInTheDocument()
  })

  it('Not for me with a reason is recorded with that reason', async () => {
    await stores.eventLog.append({
      workId: 'story-2',
      type: 'finished',
      at: finishedAt,
    })
    renderLibrary('/library?tab=finished')
    await screen.findByText('Story 2')
    fireEvent.click(screen.getByRole('button', { name: 'Rate Story 2' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Not for me' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Too dark' }))
    })
    expect(stores.events.filter((e) => e.type === 'notForMe')).toEqual([
      expect.objectContaining({ workId: 'story-2', reason: 'too-dark' }),
    ])
  })
})

describe('offline icons in the Library', () => {
  beforeEach(() => {
    // The catalog stub gives every story an empty textUrl, so give each its own file.
    resetCatalogCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) =>
        // Book files cannot be fetched here, so only the ones stored below show the icon.
        String(url).includes('catalog.json')
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                schemaVersion: 1,
                entries: fakeCatalog().map((e, i) => ({
                  ...e,
                  wordCount: 2380,
                  textUrl: `/texts/pg-${i}.epub`,
                })),
              }),
            }
          : new Response('no', { status: 404 }),
      ),
    )
    // Only story-1 and story-3 are stored.
    vi.stubGlobal(
      'caches',
      fakeCacheStorage({
        [TEXTS_CACHE]: ['/texts/pg-1.epub', '/texts/pg-3.epub'],
      }).storage,
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  const icons = (card: HTMLElement) =>
    within(card).queryAllByRole('img', { name: 'Available offline' })

  it('marks Reading, Dog-eared and Finished works that are stored', async () => {
    await stores.progressStore.set({
      workId: 'story-1',
      locator: 'x',
      percent: 40,
      secondsRead: 30,
    })
    await stores.progressStore.set({
      workId: 'story-2',
      locator: 'x',
      percent: 40,
      secondsRead: 30,
    })
    await stores.libraryStore.save('story-3')
    await stores.libraryStore.save('story-4')
    await stores.eventLog.append({
      workId: 'story-1',
      type: 'finished',
      at: Date.now() + 60_000,
    })

    // Reading: story-2 is not stored.
    renderLibrary()
    const reading = await screen.findByText('Story 2')
    expect(icons(reading.closest('li')!)).toHaveLength(0)

    fireEvent.click(tab('Kept'))
    const stored = (await screen.findByText('Story 3')).closest('li')!
    const notStored = screen.getByText('Story 4').closest('li')!
    await waitFor(() => expect(icons(stored)).toHaveLength(1))
    expect(icons(notStored)).toHaveLength(0)

    fireEvent.click(tab('Finished'))
    const finished = (await screen.findByText('Story 1')).closest('li')!
    await waitFor(() => expect(icons(finished)).toHaveLength(1))
  })
})
