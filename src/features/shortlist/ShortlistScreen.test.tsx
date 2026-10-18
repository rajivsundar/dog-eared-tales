import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import HomePage from '../../app/HomePage'
import { fakeCacheStorage } from '../../pwa/fakeCaches'
import { TEXTS_CACHE } from '../../pwa/textCache'
import { fakeCatalog, fakeStores } from './fakeStores'

// The screen uses these stores; the tests give it in-memory ones.
const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('./fakeStores').fakeStores
  >,
}))
vi.mock('../../stores', async () => {
  const { delegateManager } = await import('./fakeStores')
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
    settingsStore: delegate('settingsStore'),
    eventLog: delegate('eventLog'),
    profileStore: delegate('profileStore'),
    progressStore: delegate('progressStore'),
    libraryStore: delegate('libraryStore'),
  }
})

let stores: ReturnType<typeof fakeStores>

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  stores = fakeStores()
  h.current = stores
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, entries: fakeCatalog() }),
    })),
  )
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    now: new Date(2026, 8, 16, 9, 0),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Your Shortlist', () => {
  it('shows the name, the tagline and 6 cards with cover, title, author, minutes and reason', async () => {
    renderHome()
    expect(
      screen.getByRole('heading', { name: 'Dog-Eared Tales', level: 1 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Your Shortlist' }),
    ).toBeInTheDocument()
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(6)
    const first = items[0]
    expect(within(first).getByText(/^Story \d$/)).toBeInTheDocument()
    expect(within(first).getByText(/^Author \d$/)).toBeInTheDocument()
    expect(within(first).getByText(/^\d+ min$/)).toBeInTheDocument()
    expect(
      within(first).getByText(/A good place to start|Because you like/),
    ).toBeInTheDocument()
    expect(first.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringMatching(/^\/covers\//),
    )
  })

  it("is called Tonight's Shortlist in the evening", async () => {
    vi.setSystemTime(new Date(2026, 8, 16, 19, 0))
    renderHome()
    expect(
      await screen.findByRole('heading', { name: "Tonight's Shortlist" }),
    ).toBeInTheDocument()
  })

  it('shows the same picks after a reload on the same day', async () => {
    const first = renderHome()
    await screen.findAllByRole('listitem')
    const titles = screen.getAllByRole('listitem').map((li) => li.textContent)
    first.unmount()
    renderHome()
    await screen.findAllByRole('listitem')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      titles,
    )
    expect(stores.events.filter((e) => e.type === 'shown')).toHaveLength(6)
  })

  it('says so when the stories cannot be loaded', async () => {
    resetCatalogCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHome()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the stories.',
    )
    error.mockRestore()
  })
})

describe('detail sheet', () => {
  it('opens on a tap, records a tap event, and shows everything including content notes', async () => {
    renderHome()
    const items = await screen.findAllByRole('listitem')
    const title = within(items[0]).getByText(/^Story \d$/).textContent!
    fireEvent.click(within(items[0]).getByRole('button'))

    const sheet = await screen.findByRole('dialog', { name: title })
    const n = Number(title.slice(-1))
    expect(within(sheet).getByAltText(`Cover of ${title}`)).toBeInTheDocument()
    expect(within(sheet).getByText(`Author ${n}`)).toBeInTheDocument()
    expect(
      within(sheet).getByText(new RegExp(`${1900 + n}`)),
    ).toBeInTheDocument()
    expect(within(sheet).getByText(`Hook ${n}`)).toBeInTheDocument()
    expect(within(sheet).getByText(`Blurb ${n}`)).toBeInTheDocument()
    expect(within(sheet).getByText(`First line ${n}.`)).toBeInTheDocument()
    expect(within(sheet).getByText('Easy (grade 6)')).toBeInTheDocument()
    expect(within(sheet).getByTestId('content-notes')).toHaveTextContent(
      n === 2 ? 'violence' : 'None noted',
    )
    expect(
      within(sheet).getByRole('link', { name: 'View on Project Gutenberg' }),
    ).toHaveAttribute('href', `https://www.gutenberg.org/ebooks/${n}`)
    expect(
      within(sheet).getByRole('link', { name: 'Read now' }),
    ).toHaveAttribute('href', `/read/story-${n}`)
    expect(
      within(sheet).getByRole('button', { name: 'Dog-ear' }),
    ).toHaveAttribute('title', 'Dog-ear it for later')

    expect(stores.events.filter((e) => e.type === 'tap')).toEqual([
      expect.objectContaining({ workId: `story-${n}` }),
    ])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has a Why this pick? line', async () => {
    renderHome()
    const items = await screen.findAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByTestId('why-this-pick')).toHaveTextContent(
      /Why this pick\?.+starter mix/,
    )
  })

  it('says "from <book>" for a story in a collection', async () => {
    stores.settingsStore.update({
      shortlist: {
        date: '2026-09-16',
        picks: [
          { workId: 'story-1', reason: 'Because you like eerie stories' },
        ],
      },
    })
    renderHome()
    fireEvent.click(await screen.findByRole('button', { name: /Story 1/ }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText(/from A Big Book$/)).toBeInTheDocument()
  })

  async function dogEarFirst() {
    renderHome()
    const items = await screen.findAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Dog-ear' }))
    })
    return sheet
  }

  it('Dog-ear records save and adds the story to the library', async () => {
    const sheet = await dogEarFirst()
    const saves = stores.events.filter((e) => e.type === 'save')
    expect(saves).toHaveLength(1)
    expect(stores.library.has(saves[0].workId)).toBe(true)
    expect(
      within(sheet).getByRole('button', { name: 'Dog-eared' }),
    ).toBeEnabled()
  })

  it('tapping Dog-eared again un-dog-ears it, with Removed · Undo', async () => {
    const sheet = await dogEarFirst()
    const id = stores.events.find((e) => e.type === 'save')!.workId
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Dog-eared' }))
    })
    expect(stores.events.filter((e) => e.type === 'unsave')).toEqual([
      expect.objectContaining({ workId: id }),
    ])
    expect(stores.library.has(id)).toBe(false)
    expect(within(sheet).getByRole('button', { name: 'Dog-ear' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Removed ·')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(stores.library.has(id)).toBe(true)
    expect(stores.events.filter((e) => e.type === 'undo')).toEqual([
      expect.objectContaining({ workId: id, reason: 'unsave' }),
    ])
    expect(
      within(sheet).getByRole('button', { name: 'Dog-eared' }),
    ).toBeVisible()
  })

  it('Read now records nothing by itself', async () => {
    renderHome()
    const items = await screen.findAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button'))
    const before = stores.events.length
    fireEvent.click(screen.getByRole('link', { name: 'Read now' }))
    expect(stores.events).toHaveLength(before)
  })
})

describe('Not for me', () => {
  async function removeFirst() {
    renderHome()
    const items = await screen.findAllByRole('listitem')
    const title = within(items[0]).getByText(/^Story \d$/).textContent!
    fireEvent.click(within(items[0]).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Not for me' }))
    })
    return title
  }

  it('swaps the card at once and shows Removed · Undo', async () => {
    const title = await removeFirst()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByText(title)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Removed ·')
    expect(stores.events.some((e) => e.type === 'notForMe')).toBe(true)
  })

  it('Undo brings the card back and records undo', async () => {
    const title = await removeFirst()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(stores.events.some((e) => e.type === 'undo')).toBe(true)
  })

  it('the message goes away after 5 seconds', async () => {
    await removeFirst()
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Your Long List', () => {
  // story-0..2 are short stories; the rest are novelettes and novellas of an hour.
  function stubLongCatalog() {
    resetCatalogCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 1,
          entries: Array.from({ length: 24 }, (_, i) => ({
            ...fakeCatalog()[i % 10],
            id: `story-${i}`,
            title: `Story ${i}`,
            form: i < 3 ? 'story' : i % 2 === 0 ? 'novella' : 'novelette',
            lengthClass: i < 3 ? 'under10' : '60plus',
            readingMinutes: i < 3 ? 8 : 60,
          })),
        }),
      })),
    )
  }
  const rateThree = async () => {
    for (const id of ['story-0', 'story-1', 'story-2']) {
      await stores.eventLog.append({ workId: id, type: 'finished' })
      await stores.eventLog.append({ workId: id, type: 'love' })
    }
  }

  it('is not on the page before 3 positive finishes, not even an empty heading', async () => {
    stubLongCatalog()
    renderHome()
    await screen.findAllByRole('listitem')
    expect(screen.queryByText('Your Long List')).not.toBeInTheDocument()
  })

  it('appears below Your Shortlist after 3, with sittings on each card', async () => {
    stubLongCatalog()
    await rateThree()
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const shortlist = screen.getByRole('heading', { name: /Shortlist/ })
    expect(
      shortlist.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const section = heading.closest('section')!
    const cards = within(section).getAllByRole('listitem')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(4)
    // Total minutes and the default 15-minute sitting.
    expect(cards[0]).toHaveTextContent('60 min')
    expect(cards[0]).toHaveTextContent('About 4 sittings of 15 min')
    expect(cards[0].querySelector('img')).not.toBeNull()
  })

  it('uses the median of the latest sessions for the sitting', async () => {
    stubLongCatalog()
    await rateThree()
    for (const seconds of [1700, 1800, 1900]) {
      await stores.eventLog.append({
        workId: 'story-3',
        type: 'session',
        value: seconds,
      })
    }
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    expect(
      within(heading.closest('section')!).getAllByRole('listitem')[0],
    ).toHaveTextContent('About 2 sittings of 30 min')
  })

  it('never repeats a work from Your Shortlist', async () => {
    stubLongCatalog()
    await rateThree()
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const longTitles = within(heading.closest('section')!)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('span.font-serif')?.textContent)
    const shortSection = screen
      .getByRole('heading', { name: /Shortlist/ })
      .closest('section')!
    const shortTitles = within(shortSection)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('span.font-serif')?.textContent)
    for (const t of longTitles) expect(shortTitles).not.toContain(t)
  })

  it('opens the same detail sheet, and records a tap', async () => {
    stubLongCatalog()
    await rateThree()
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const card = within(heading.closest('section')!).getAllByRole('listitem')[0]
    fireEvent.click(within(card).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('button', { name: 'Dog-ear' })).toBeVisible()
    expect(
      within(sheet).getByRole('button', { name: 'Not for me' }),
    ).toBeVisible()
    expect(within(sheet).getByTestId('why-this-pick')).toHaveTextContent(
      /longer read/,
    )
    expect(stores.events.filter((e) => e.type === 'tap')).toHaveLength(1)
  })

  it('Not for me on a Long List card swaps it, and Undo brings it back', async () => {
    stubLongCatalog()
    await rateThree()
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const section = heading.closest('section')!
    const before = within(section)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    fireEvent.click(
      within(within(section).getAllByRole('listitem')[0]).getByRole('button'),
    )
    const sheet = await screen.findByRole('dialog')
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Not for me' }))
    })
    const titles = () =>
      within(section)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    await waitFor(() => expect(titles()).not.toContain(before[0]))
    // The other cards are untouched, and the removed one is replaced in its place (or dropped).
    for (const kept of before.slice(1)) expect(titles()).toContain(kept)
    expect(screen.getByRole('status')).toHaveTextContent('Removed ·')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(before)
  })

  it('records shown once per day for its cards', async () => {
    stubLongCatalog()
    await rateThree()
    const first = renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const n = within(heading.closest('section')!).getAllByRole(
      'listitem',
    ).length
    first.unmount()
    renderHome()
    await screen.findByRole('heading', { name: 'Your Long List' })
    const shown = stores.events.filter((e) => e.type === 'shown')
    expect(shown).toHaveLength(6 + n)
  })
})

describe('offline books', () => {
  const epub = (i: number) => `/texts/pg-${i}.epub`
  function stubOffline(
    options: { cached?: number[]; textsFail?: boolean } = {},
  ) {
    resetCatalogCache()
    const fake = fakeCacheStorage({
      [TEXTS_CACHE]: (options.cached ?? []).map(epub),
    })
    vi.stubGlobal('caches', fake.storage)
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('catalog.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schemaVersion: 1,
            entries: Array.from({ length: 24 }, (_, i) => ({
              ...fakeCatalog()[i % 10],
              id: `story-${i}`,
              title: `Story ${i}`,
              textUrl: epub(i),
              form: i < 3 ? 'story' : i % 2 === 0 ? 'novella' : 'novelette',
              lengthClass: i < 3 ? 'under10' : '60plus',
              readingMinutes: i < 3 ? 8 : 60,
            })),
          }),
        }
      }
      return options.textsFail
        ? new Response('no', { status: 404 })
        : new Response('book', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const textFetches = () =>
      fetchMock.mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.startsWith('/texts/'))
    return { fake, textFetches }
  }
  const numberOf = (li: HTMLElement) =>
    Number(li.textContent?.match(/Story (\d+)/)?.[1])
  const rateThree = async () => {
    for (const id of ['story-0', 'story-1', 'story-2']) {
      await stores.eventLog.append({ workId: id, type: 'finished' })
      await stores.eventLog.append({ workId: id, type: 'love' })
    }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('quietly stores the book of every pick on both lists, each file once', async () => {
    const { fake, textFetches } = stubOffline()
    await rateThree()
    renderHome()
    await screen.findByRole('heading', { name: 'Your Long List' })
    const titles = screen.getAllByRole('listitem').map((li) => numberOf(li))
    await waitFor(() => expect(textFetches().length).toBe(new Set(titles).size))
    expect(new Set(textFetches())).toEqual(new Set(titles.map(epub)))
    expect(textFetches()).toHaveLength(new Set(textFetches()).size)
    await waitFor(() =>
      expect(new Set(fake.paths(TEXTS_CACHE))).toEqual(
        new Set(titles.map(epub)),
      ),
    )
  })

  it('fetches each file once even when the page builds its lists twice', async () => {
    const { textFetches } = stubOffline()
    // StrictMode runs every effect twice, like two quick builds of the shortlist.
    render(
      <StrictMode>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </StrictMode>,
    )
    await screen.findAllByRole('listitem')
    const expected = screen
      .getAllByRole('listitem')
      .map((li) => epub(numberOf(li)))
    await waitFor(() =>
      expect(textFetches().length).toBe(new Set(expected).size),
    )
    // Give any second round of fetches time to show up, then count.
    await new Promise((r) => setTimeout(r, 50))
    expect(textFetches().sort()).toEqual([...new Set(expected)].sort())
  })

  it('does not fetch a book again when the page is visited a second time', async () => {
    const { textFetches } = stubOffline()
    const first = renderHome()
    await screen.findAllByRole('listitem')
    await waitFor(() => expect(textFetches().length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 50))
    const once = textFetches().length
    first.unmount()
    renderHome()
    await screen.findAllByRole('listitem')
    await new Promise((r) => setTimeout(r, 50))
    expect(textFetches()).toHaveLength(once)
  })

  it('also stores Dog-eared works and works under Reading', async () => {
    const { fake } = stubOffline()
    await stores.libraryStore.save('story-20')
    await stores.progressStore.set({
      workId: 'story-21',
      locator: 'x',
      percent: 30,
      secondsRead: 60,
    })
    renderHome()
    await screen.findAllByRole('listitem')
    await waitFor(() => {
      expect(fake.paths(TEXTS_CACHE)).toContain(epub(20))
      expect(fake.paths(TEXTS_CACHE)).toContain(epub(21))
    })
  })

  it('shows an Available offline icon only on cards whose book is stored', async () => {
    // Only the even-numbered books are stored; the others cannot be fetched.
    stubOffline({
      cached: Array.from({ length: 12 }, (_, i) => i * 2),
      textsFail: true,
    })
    renderHome()
    const cards = await screen.findAllByRole('listitem')
    await waitFor(() =>
      expect(
        screen.getAllByRole('img', { name: 'Available offline' }).length,
      ).toBeGreaterThan(0),
    )
    for (const card of cards) {
      const stored = numberOf(card) % 2 === 0
      expect(
        within(card).queryAllByRole('img', { name: 'Available offline' }),
        card.textContent ?? '',
      ).toHaveLength(stored ? 1 : 0)
    }
  })

  it('shows no icon when nothing is stored', async () => {
    const { textFetches } = stubOffline()
    // Offline, so nothing gets stored either.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderHome()
    await screen.findAllByRole('listitem')
    expect(
      screen.queryAllByRole('img', { name: 'Available offline' }),
    ).toHaveLength(0)
    expect(textFetches()).toEqual([])
    vi.restoreAllMocks()
  })

  it('shows Available offline in the detail sheet for a stored book', async () => {
    stubOffline({ cached: Array.from({ length: 24 }, (_, i) => i) })
    renderHome()
    const items = await screen.findAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Available offline')).toBeInTheDocument()
  })

  it('leaves it out of the detail sheet when the book is not stored', async () => {
    stubOffline()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderHome()
    const items = await screen.findAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button'))
    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet).queryByText('Available offline'),
    ).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('shows the icon on Your Long List cards too', async () => {
    stubOffline({ cached: Array.from({ length: 24 }, (_, i) => i) })
    await rateThree()
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Long List',
    })
    const cards = within(heading.closest('section')!).getAllByRole('listitem')
    await waitFor(() =>
      expect(
        within(cards[0]).getByRole('img', { name: 'Available offline' }),
      ).toBeInTheDocument(),
    )
  })
})

describe('the Tune your picks card', () => {
  const tune = () => screen.queryByRole('region', { name: 'Tune your picks' })
  const finishOne = () =>
    stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 1 })

  it('is not shown before the first finished story', async () => {
    renderHome()
    await screen.findAllByRole('listitem')
    expect(tune()).not.toBeInTheDocument()
  })

  it('is shown at the top after the first finished story, with a link to the taste cards', async () => {
    await finishOne()
    renderHome()
    const card = await screen.findByRole('region', { name: 'Tune your picks' })
    expect(
      within(card).getByRole('link', { name: 'Tune now' }),
    ).toHaveAttribute('href', '/tune')
    // It sits above Your Shortlist.
    const shortlist = screen.getByRole('heading', { name: /Shortlist/ })
    expect(
      card.compareDocumentPosition(shortlist) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('can be dismissed, and stays dismissed', async () => {
    await finishOne()
    const first = renderHome()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Dismiss Tune your picks' }),
    )
    expect(tune()).not.toBeInTheDocument()
    await waitFor(async () =>
      expect((await stores.settingsStore.get()).tuneDismissed).toBe(true),
    )
    first.unmount()
    renderHome()
    await screen.findAllByRole('listitem')
    expect(tune()).not.toBeInTheDocument()
  })

  it('is not shown once the taste cards have been answered', async () => {
    await finishOne()
    await stores.eventLog.append({
      workId: 'story-3',
      type: 'onboard',
      reason: 'love',
    })
    renderHome()
    await screen.findAllByRole('listitem')
    expect(tune()).not.toBeInTheDocument()
  })
})
