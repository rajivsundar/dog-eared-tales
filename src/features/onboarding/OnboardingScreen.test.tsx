import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import OnboardingScreen from './OnboardingScreen'

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
    profileStore: delegate('profileStore'),
    settingsStore: delegate('settingsStore'),
  }
})

let stores: ReturnType<typeof fakeStores>

/** Stands in for the reader: shows which story was opened. */
function ReaderStub() {
  const { id } = useParams()
  return <p>READER {id}</p>
}

function renderOnboarding(path = '/welcome') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/welcome" element={<OnboardingScreen />} />
        <Route path="/" element={<p>YOUR SHORTLIST</p>} />
        <Route path="/read/:id" element={<ReaderStub />} />
        <Route path="/settings" element={<p>SETTINGS</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

const MOODS = [
  'cozy',
  'eerie',
  'funny',
  'romantic',
  'thoughtful',
  'adventurous',
  'melancholy',
  'uplifting',
  'tense',
  'whimsical',
  'dark',
  'hopeful',
]

/** A catalog with the welcome stories and enough variety for the mood board and taste cards. */
function catalogEntries() {
  const named = [
    ['pg-269-the-open-window', 'The Open Window', 5],
    ['pg-2148-the-tell-tale-heart', 'The Tell-Tale Heart', 9],
    ['pg-7256-the-gift-of-the-magi', 'The Gift of the Magi', 9],
    [
      'pg-932-the-fall-of-the-house-of-usher',
      'The Fall of the House of Usher',
      25,
    ],
    ['pg-14522-the-canterville-ghost', 'The Canterville Ghost', 55],
  ] as const
  const welcome = named.map(([id, title, minutes], i) => ({
    ...fakeCatalog()[i],
    id,
    title,
    coverUrl: `/covers/${id}.svg`,
    readingMinutes: minutes,
    lengthClass: minutes < 10 ? 'under10' : minutes < 30 ? '10to30' : '30to60',
    moods: [MOODS[i]],
    form: 'story',
  }))
  const more = Array.from({ length: 24 }, (_, i) => ({
    ...fakeCatalog()[i % 10],
    id: `w${i}`,
    title: `Work ${i}`,
    moods: [MOODS[i % 12]],
    form: i === 5 ? 'essay' : 'story',
    lengthClass: i % 3 === 0 ? 'under10' : '10to30',
    firstLine: `The genuine first line of work ${i}.`,
  }))
  return [...welcome, ...more]
}

function setDate(year: number, month: number, day: number) {
  vi.setSystemTime(new Date(year, month - 1, day, 12))
}

beforeEach(() => {
  stores = fakeStores()
  h.current = stores
  resetCatalogCache()
  vi.useFakeTimers({ toFake: ['Date'] })
  setDate(2026, 3, 3) // out of season, unless a test says otherwise
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, entries: catalogEntries() }),
    })),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const welcome = async () => {
  renderOnboarding()
  await screen.findByTestId('featured-story')
}

describe('the welcome page', () => {
  it('has the wordmark, the headline as the h1, the subline and the trust line', async () => {
    await welcome()
    expect(screen.getByText('Dog-Eared Tales')).toBeInTheDocument()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Free classics, picked for you.')
    expect(h1).toHaveFocus()
    expect(
      screen.getByText('Start short. Fold down a corner when one gets you.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Free · No account · No ads · Your reading stays on your phone',
      ),
    ).toBeInTheDocument()
  })

  it('shows a fan of three real covers, hidden from screen readers', async () => {
    await welcome()
    const fan = screen.getByTestId('cover-fan')
    expect(fan).toHaveAttribute('aria-hidden', 'true')
    const srcs = [...fan.querySelectorAll('img')].map((i) =>
      i.getAttribute('src'),
    )
    expect(srcs).toEqual([
      '/covers/pg-269-the-open-window.svg',
      '/covers/pg-2148-the-tell-tale-heart.svg',
      '/covers/pg-7256-the-gift-of-the-magi.svg',
    ])
  })

  it('has "Read a short story now" with the featured story and its minutes under it', async () => {
    await welcome()
    expect(
      screen.getByRole('button', { name: 'Read a short story now' }),
    ).toBeEnabled()
    expect(screen.getByTestId('featured-story')).toHaveTextContent(
      'The Open Window · 5 min',
    )
    expect(
      screen.getByRole('button', { name: 'Pick my moods first' }),
    ).toBeEnabled()
  })

  it('reveals the About note from "Why Dog-Eared Tales?" and hides it again', async () => {
    await welcome()
    const why = screen.getByRole('button', { name: /Why .Dog-Eared Tales.\?/ })
    expect(why).toHaveAttribute('aria-expanded', 'false')
    const line =
      'A dog-ear is the folded corner of a page, the mark of a book somebody loved. Dog-Eared Tales is a place for stories worth turning down a corner for.'
    expect(screen.getByText(line)).not.toBeVisible()
    fireEvent.click(why)
    expect(why).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(line)).toBeVisible()
    fireEvent.click(why)
    expect(screen.getByText(line)).not.toBeVisible()
  })

  it('uses the fall content on Oct 16: headline, button, featured story and covers', async () => {
    setDate(2026, 10, 16)
    await welcome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Fall for the classics.',
    )
    expect(
      screen.getByText('Great free stories, picked for you. Start short.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Turn over a new leaf' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Read a short story now' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('featured-story')).toHaveTextContent(
      'The Tell-Tale Heart · 9 min',
    )
    const srcs = [
      ...screen.getByTestId('cover-fan').querySelectorAll('img'),
    ].map((i) => i.getAttribute('src'))
    expect(srcs).toEqual([
      '/covers/pg-2148-the-tell-tale-heart.svg',
      '/covers/pg-932-the-fall-of-the-house-of-usher.svg',
      '/covers/pg-14522-the-canterville-ghost.svg',
    ])
  })

  it('goes back to the defaults on Dec 1', async () => {
    setDate(2026, 12, 1)
    await welcome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Free classics, picked for you.',
    )
    expect(
      screen.getByRole('button', { name: 'Read a short story now' }),
    ).toBeInTheDocument()
  })

  it('uses the halloween content on Oct 25 and Oct 31, and fall on Nov 1', async () => {
    for (const [month, day] of [
      [10, 25],
      [10, 31],
      [11, 1],
    ]) {
      setDate(2026, month, day)
      const view = renderOnboarding()
      await screen.findByTestId('featured-story')
      expect(
        screen.getByRole('button', { name: 'Turn over a new leaf' }),
      ).toBeInTheDocument()
      view.unmount()
      resetCatalogCache()
    }
  })
})

describe('"Read a short story now"', () => {
  it('saves an empty profile and opens the featured story straight in the reader', async () => {
    await welcome()
    await act(async () => {
      click('Read a short story now')
    })
    expect(
      await screen.findByText('READER pg-269-the-open-window'),
    ).toBeInTheDocument()
    const profile = await stores.profileStore.get()
    expect(profile).toBeDefined()
    expect(profile?.facetBeliefs).toEqual({})
    // Nothing else is recorded: the first rating after the story seeds the profile.
    expect(stores.events).toHaveLength(0)
  })

  it('opens the seasonal story in season', async () => {
    setDate(2026, 10, 16)
    renderOnboarding()
    await screen.findByTestId('featured-story')
    await act(async () => {
      click('Turn over a new leaf')
    })
    expect(
      await screen.findByText('READER pg-2148-the-tell-tale-heart'),
    ).toBeInTheDocument()
  })

  it('leaves the welcome page for good: this is no longer a first run', async () => {
    await welcome()
    await act(async () => {
      click('Read a short story now')
    })
    await screen.findByText(/^READER /)
    const { isFirstRun } = await import('./finishOnboarding')
    expect(
      await isFirstRun({
        events: stores.eventLog,
        profile: stores.profileStore,
      }),
    ).toBe(false)
  })
})

describe('"Pick my moods first"', () => {
  async function toMoodBoard() {
    await welcome()
    click('Pick my moods first')
    return screen.findByRole('heading', { name: /in the mood for/ })
  }

  it('has 12 labelled toggle buttons and moves focus to the heading', async () => {
    const heading = await toMoodBoard()
    expect(heading).toHaveFocus()
    const tiles = within(screen.getByRole('group')).getAllByRole('button')
    expect(tiles).toHaveLength(12)
    for (const tile of tiles)
      expect(tile).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps Next disabled below 2 moods, with a hint, and allows at most 5', async () => {
    await toMoodBoard()
    const next = screen.getByRole('button', { name: 'Show my shortlist' })
    expect(next).toBeDisabled()
    expect(next).toHaveAttribute('aria-describedby', 'mood-hint')
    expect(screen.getByText(/Pick at least 2 moods/)).toBeInTheDocument()
    click('Eerie')
    click('Cozy')
    expect(next).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('2 of 5 picked')
    for (const m of ['Funny', 'Romantic', 'Tense']) click(m)
    expect(screen.getByRole('button', { name: 'Dark' })).toBeDisabled()
  })

  it('goes straight to Your Shortlist: no taste cards, no reading context', async () => {
    await toMoodBoard()
    click('Eerie')
    click('Cozy')
    await act(async () => {
      click('Show my shortlist')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /catch your eye/ }),
    ).not.toBeInTheDocument()
    expect(
      stores.events.filter((e) => e.type === 'onboard').map((e) => e.reason),
    ).toEqual(['start', 'mood:eerie', 'mood:cozy'])
    expect((await stores.settingsStore.get()).shortlist?.picks).toHaveLength(6)
  })

  it('has one Skip, which goes straight to the starter mix; there is no "Skip setup"', async () => {
    await toMoodBoard()
    expect(
      screen.queryByRole('button', { name: 'Skip setup' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Skip/ })).toHaveLength(1)
    await act(async () => {
      click('Skip')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect(stores.events.filter((e) => e.type === 'onboard')).toHaveLength(1)
    expect((await stores.profileStore.get())?.facetBeliefs).toEqual({})
    const shortlist = (await stores.settingsStore.get()).shortlist
    expect(shortlist?.picks).toHaveLength(6)
    expect(
      shortlist?.picks.every((p) =>
        p.reason.startsWith('A good place to start'),
      ),
    ).toBe(true)
  })

  it('Back returns to the welcome page', async () => {
    await toMoodBoard()
    click('Back')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Free classics, picked for you.',
    )
  })
})

describe('Redo onboarding (the full flow)', () => {
  async function redo() {
    renderOnboarding('/welcome?redo=1')
    return screen.findByRole('heading', { name: /in the mood for/ })
  }

  it('starts at the mood board, without the welcome page', async () => {
    const heading = await redo()
    expect(heading).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: 'Read a short story now' }),
    ).not.toBeInTheDocument()
    click('Back')
    expect(await screen.findByText('SETTINGS')).toBeInTheDocument()
  })

  it('goes on to the taste cards and the reading context, then the shortlist', async () => {
    await redo()
    click('Eerie')
    click('Cozy')
    click('Next')
    expect(
      await screen.findByRole('heading', { name: /catch your eye/ }),
    ).toBeInTheDocument()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(8)
    expect(within(cards[0]).getByText(/^Work \d+$|^The /)).toBeInTheDocument()
    expect(within(cards[0]).getByText(/^\d+ min$/)).toBeInTheDocument()
    expect(cards[0].querySelector('blockquote')).not.toBeNull()
    expect(screen.getAllByRole('group')[0]).toHaveAccessibleName(
      /^Your reaction to /,
    )
    fireEvent.click(within(cards[0]).getByRole('radio', { name: 'Love' }))
    fireEvent.click(within(cards[1]).getByRole('radio', { name: 'Not for me' }))
    click('Next')
    expect(
      await screen.findByRole('heading', { name: 'When do you usually read?' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Commute' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Weekends' }))
    await act(async () => {
      click('Show me my shortlist')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    const reasons = stores.events
      .filter((e) => e.type === 'onboard')
      .map((e) => e.reason)
    expect(reasons).toEqual([
      'start',
      'mood:eerie',
      'mood:cozy',
      'love',
      'notForMe',
    ])
    expect((await stores.profileStore.get())?.ladderLevel).toBe(2)
  })

  it('Skip on the mood board shows the starter-mix cards', async () => {
    await redo()
    click('Skip')
    expect(
      await screen.findByRole('heading', { name: /catch your eye/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })

  it('the reading context can be skipped, and Back returns to the cards', async () => {
    await redo()
    click('Skip')
    await screen.findByRole('heading', { name: /catch your eye/ })
    click('Next')
    await screen.findByRole('heading', { name: 'When do you usually read?' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Evenings' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lunch break' }))
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    click('Back')
    expect(
      await screen.findByRole('heading', { name: /catch your eye/ }),
    ).toBeInTheDocument()
    click('Next')
    await screen.findByRole('heading', { name: 'When do you usually read?' })
    await act(async () => {
      click('Skip')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect((await stores.profileStore.get())?.ladderLevel).toBe(0)
  })
})

describe('the fall artwork on the welcome page', () => {
  it('draws the reading chair and falling leaves in fall', async () => {
    setDate(2026, 10, 16)
    await welcome()
    expect(await screen.findByTestId('season-scene')).toBeInTheDocument()
    expect(screen.getByTestId('season-leaves')).toBeInTheDocument()
    // Decorative: hidden from screen readers.
    expect(screen.getByTestId('season-scene')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('draws nothing out of season', async () => {
    setDate(2026, 12, 1)
    await welcome()
    expect(screen.queryByTestId('season-scene')).toBeNull()
    expect(screen.queryByTestId('season-leaves')).toBeNull()
  })

  it('draws nothing, and uses the defaults, when seasonal themes are off', async () => {
    setDate(2026, 10, 16)
    await stores.settingsStore.update({ seasonalThemes: false })
    renderOnboarding()
    await screen.findByTestId('featured-story')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Free classics, picked for you.',
    )
    expect(
      screen.getByRole('button', { name: 'Read a short story now' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('season-scene')).toBeNull()
    expect(screen.queryByTestId('season-leaves')).toBeNull()
  })
})

describe('the welcome preview (/welcome?preview=1)', () => {
  it('shows the welcome screen and changes no data', async () => {
    setDate(2026, 10, 16)
    await stores.eventLog.append({ workId: 'story-1', type: 'finished' })
    await stores.libraryStore.save('story-2')
    const before = JSON.stringify({
      events: stores.events,
      library: [...stores.library],
      settings: await stores.settingsStore.get(),
      profile: await stores.profileStore.get(),
    })
    renderOnboarding('/welcome?preview=1')
    await screen.findByTestId('featured-story')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preview of the welcome screen. Nothing is saved.',
    )
    // The buttons do nothing in a preview.
    expect(
      screen.getByRole('button', { name: 'Turn over a new leaf' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Pick my moods first' }),
    ).toBeDisabled()
    expect(
      JSON.stringify({
        events: stores.events,
        library: [...stores.library],
        settings: await stores.settingsStore.get(),
        profile: await stores.profileStore.get(),
      }),
    ).toBe(before)
    fireEvent.click(screen.getByRole('link', { name: 'Back to Settings' }))
    expect(await screen.findByText('SETTINGS')).toBeInTheDocument()
  })
})
