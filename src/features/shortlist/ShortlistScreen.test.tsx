import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import HomePage from '../../app/HomePage'
import { fakeCatalog, fakeStores } from './fakeStores'

// The screen uses these stores; the tests give it in-memory ones.
const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('./fakeStores').fakeStores
  >,
}))
vi.mock('../../stores', () => {
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
    now: new Date(2026, 9, 16, 9, 0),
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
      screen.getByRole('heading', { name: 'Twice Told', level: 1 }),
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
    vi.setSystemTime(new Date(2026, 9, 16, 19, 0))
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
        date: '2026-10-16',
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
