import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '../../app/HomePage'
import { resetCatalogCache } from '../../catalog'
import { fakeCatalog, fakeStores } from './fakeStores'

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

const USHER = 'pg-932-the-fall-of-the-house-of-usher'

function catalog() {
  const base = fakeCatalog()
  const template = base[1]
  return [
    ...base,
    {
      ...template,
      id: USHER,
      title: 'The Fall of the House of Usher',
      bookTitle: 'The Fall of the House of Usher',
      isCollection: false,
      genres: ['horror', 'literary'],
      moods: ['eerie', 'dark'],
      contentNotes: ['death', 'illness'],
      form: 'story',
    },
    {
      ...template,
      id: 'essay-eerie',
      title: 'An Eerie Essay',
      bookTitle: 'An Eerie Essay',
      isCollection: false,
      form: 'essay',
      moods: ['eerie', 'dark'],
    },
    {
      ...template,
      id: 'satire-dark',
      title: 'A Dark Satire',
      bookTitle: 'A Dark Satire',
      isCollection: false,
      form: 'story',
      genres: ['satire'],
      moods: ['dark'],
    },
  ]
}

let stores: ReturnType<typeof fakeStores>

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

function on(month: number, day: number) {
  vi.setSystemTime(new Date(2026, month - 1, day, 11, 0))
}

/** Today's Your Shortlist, chosen by the test (in the stored form). */
async function shortlistOf(...ids: string[]) {
  await stores.settingsStore.update({
    shortlist: {
      date: '2026-10-16',
      picks: ids.map((workId) => ({ workId, reason: 'A good place to start' })),
    },
  })
}

beforeEach(async () => {
  stores = fakeStores()
  h.current = stores
  // By default the shortlist holds no eerie works, so the row has them all to choose from.
  await shortlistOf(
    'story-0',
    'story-2',
    'story-3',
    'story-4',
    'story-7',
    'story-8',
  )
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, entries: catalog() }),
    })),
  )
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    now: new Date(2026, 9, 16, 11, 0),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const row = async () =>
  screen.findByRole('region', { name: 'Tales for Longer Nights' })

describe('Tales for Longer Nights', () => {
  it('appears in fall, below Your Shortlist, with Usher first and its reason', async () => {
    renderHome()
    const tales = await row()
    const items = within(tales).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('The Fall of the House of Usher')
    expect(items[0]).toHaveTextContent("This fall's best-named story")
    // Only fiction that is eerie, a ghost story or horror: no essay, no merely dark satire.
    expect(tales).not.toHaveTextContent('An Eerie Essay')
    expect(tales).not.toHaveTextContent('A Dark Satire')
    expect(items.length).toBeLessThanOrEqual(6)
    // Order on the page: Your Shortlist, then the row.
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '')
    expect(headings.indexOf('Tales for Longer Nights')).toBeGreaterThan(
      headings.findIndex((t) => /Shortlist/.test(t)),
    )
  })

  it('shows the content notes on each card', async () => {
    renderHome()
    const tales = await row()
    expect(
      within(tales.querySelector('li')!).getByText(
        'Content notes: death, illness',
      ),
    ).toBeInTheDocument()
  })

  it('is called "Ghost stories for Halloween" from Oct 25 to 31', async () => {
    on(10, 28)
    renderHome()
    expect(
      await screen.findByRole('region', {
        name: 'Ghost stories for Halloween',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Tales for Longer Nights' }),
    ).toBeNull()
  })

  it('is back to Tales for Longer Nights on Nov 1', async () => {
    on(11, 1)
    renderHome()
    expect(await row()).toBeInTheDocument()
  })

  it('is gone out of season', async () => {
    on(12, 1)
    renderHome()
    await screen.findByRole('heading', { name: 'Your Shortlist' })
    expect(screen.queryByRole('region', { name: /Longer Nights/ })).toBeNull()
    expect(screen.queryByText(/Ghost stories for Halloween/)).toBeNull()
  })

  it('is gone when seasonal themes are off', async () => {
    await stores.settingsStore.update({ seasonalThemes: false })
    renderHome()
    await screen.findByRole('heading', { name: 'Your Shortlist' })
    await screen.findByText(/Free classics, picked for you/)
    expect(screen.queryByRole('region', { name: /Longer Nights/ })).toBeNull()
  })

  it('leaves out finished works', async () => {
    await stores.eventLog.append({ workId: USHER, type: 'finished' })
    await stores.eventLog.append({ workId: 'story-6', type: 'finished' })
    renderHome()
    const tales = await row()
    expect(tales).not.toHaveTextContent('The Fall of the House of Usher')
    expect(tales).not.toHaveTextContent('Story 6')
  })

  it('leaves out works marked Not for me, and Not for me on a card removes it', async () => {
    await stores.eventLog.append({ workId: 'story-6', type: 'notForMe' })
    renderHome()
    const tales = await row()
    expect(tales).not.toHaveTextContent('Story 6')

    fireEvent.click(
      within(tales).getByRole('button', {
        name: /The Fall of the House of Usher/,
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Not for me' }))
    await vi.waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Tales for Longer Nights' }),
      ).not.toHaveTextContent('The Fall of the House of Usher'),
    )
    expect(
      stores.events.filter((e) => e.workId === USHER && e.type === 'notForMe'),
    ).toHaveLength(1)
  })

  it('skips works already on today’s Your Shortlist', async () => {
    await shortlistOf(
      USHER,
      'story-6',
      'story-0',
      'story-2',
      'story-3',
      'story-4',
    )
    renderHome()
    const tales = await row()
    expect(tales).not.toHaveTextContent('The Fall of the House of Usher')
    expect(tales).not.toHaveTextContent('Story 6')
    expect(within(tales).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('leaves out science fiction unless it is also horror or a ghost story', async () => {
    // The stand-in catalog has no science fiction, so add some.
    const base = catalog()
    base.push(
      {
        ...base[1],
        id: 'sf-eerie',
        title: 'An Eerie Rocket',
        isCollection: false,
        genres: ['science fiction'],
        moods: ['eerie'],
      },
      {
        ...base[1],
        id: 'sf-horror',
        title: 'A Horror Rocket',
        isCollection: false,
        genres: ['science fiction', 'horror'],
        moods: ['tense'],
      },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ schemaVersion: 1, entries: base }),
      })),
    )
    renderHome()
    const tales = await row()
    expect(tales).not.toHaveTextContent('An Eerie Rocket')
    expect(tales).toHaveTextContent('A Horror Rocket')
  })

  it('keeps its picks in the settings, so their books are stored for offline', async () => {
    renderHome()
    await row()
    const saved = (await stores.settingsStore.get()).talesRow
    expect(saved?.picks.map((p) => p.workId)).toContain(USHER)
  })
})

describe('the line under the heading', () => {
  it('says "Fresh picks for longer nights" in fall, in place of the tagline', async () => {
    renderHome()
    expect(
      await screen.findByText('Fresh picks for longer nights'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Free classics, picked for you/)).toBeNull()
  })

  it('is the usual tagline out of season, and with seasonal themes off', async () => {
    on(12, 1)
    const first = renderHome()
    expect(
      await screen.findByText(/Free classics, picked for you/),
    ).toBeInTheDocument()
    first.unmount()
    on(10, 16)
    await stores.settingsStore.update({ seasonalThemes: false })
    renderHome()
    expect(
      await screen.findByText(/Free classics, picked for you/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Fresh picks for longer nights')).toBeNull()
  })

  it('puts a small leaf on the heading in fall only', async () => {
    renderHome()
    const heading = await screen.findByRole('heading', {
      name: 'Your Shortlist',
    })
    await vi.waitFor(() => expect(heading.querySelector('svg')).not.toBeNull())
  })
})
