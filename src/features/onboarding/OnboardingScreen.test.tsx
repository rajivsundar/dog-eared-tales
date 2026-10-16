import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import OnboardingScreen from './OnboardingScreen'

const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('../shortlist/fakeStores').fakeStores
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
    eventLog: delegate('eventLog'),
    profileStore: delegate('profileStore'),
    settingsStore: delegate('settingsStore'),
  }
})

let stores: ReturnType<typeof fakeStores>

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<OnboardingScreen />} />
        <Route path="/" element={<p>YOUR SHORTLIST</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  stores = fakeStores()
  h.current = stores
  resetCatalogCache()
  // A catalog with 12 moods, so every mood tile has works.
  const moods = [
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
  const entries = Array.from({ length: 24 }, (_, i) => ({
    ...fakeCatalog()[i % 10],
    id: `w${i}`,
    title: `Work ${i}`,
    moods: [moods[i % 12]],
    form: i === 5 ? 'essay' : 'story',
    lengthClass: i % 3 === 0 ? 'under10' : '10to30',
    firstLine: `The genuine first line of work ${i}.`,
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, entries }),
    })),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('the welcome step', () => {
  it('shows the name, tagline, privacy promise and the button', async () => {
    renderOnboarding()
    expect(
      screen.getByRole('heading', { name: 'Twice Told', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Great free stories, picked for you. Start short. Fall for the classics.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Your reading data stays on this device'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Find my first story' }),
    ).toBeInTheDocument()
  })
})

describe('the mood board', () => {
  async function toMoodBoard() {
    renderOnboarding()
    click('Find my first story')
    return screen.findByRole('heading', { name: /in the mood for/ })
  }

  it('has 12 labelled toggle buttons and moves focus to the heading', async () => {
    const heading = await toMoodBoard()
    expect(heading).toHaveFocus()
    const group = screen.getByRole('group')
    const tiles = within(group).getAllByRole('button')
    expect(tiles).toHaveLength(12)
    for (const tile of tiles)
      expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByRole('button', { name: 'Eerie' })).toBeVisible()
  })

  it('disables Next below 2 moods, with a hint, and enables it at 2', async () => {
    await toMoodBoard()
    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeDisabled()
    expect(screen.getByText(/Pick at least 2 moods/)).toBeInTheDocument()
    expect(next).toHaveAttribute('aria-describedby', 'mood-hint')
    click('Eerie')
    expect(next).toBeDisabled()
    click('Cozy')
    expect(next).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('2 of 5 picked')
    expect(screen.queryByText(/Pick at least 2 moods/)).not.toBeInTheDocument()
  })

  it('allows at most 5 moods', async () => {
    await toMoodBoard()
    for (const m of ['Cozy', 'Eerie', 'Funny', 'Romantic', 'Tense']) click(m)
    expect(screen.getByRole('button', { name: 'Dark' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 picked')
    click('Tense')
    expect(screen.getByRole('button', { name: 'Dark' })).toBeEnabled()
  })

  it('Skip goes to the taste cards with the balanced mix', async () => {
    await toMoodBoard()
    click('Skip')
    expect(
      await screen.findByRole('heading', { name: /catch your eye/ }),
    ).toBeInTheDocument()
    const cards = screen.getAllByRole('group')
    expect(cards).toHaveLength(8)
    expect(stores.events).toHaveLength(0)
  })

  it('Skip setup ends onboarding at once with the starter mix', async () => {
    await toMoodBoard()
    await act(async () => {
      click('Skip setup')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect(stores.events.filter((e) => e.type === 'onboard')).toHaveLength(1)
    expect((await stores.profileStore.get())?.facetBeliefs).toEqual({})
    expect((await stores.settingsStore.get()).shortlist?.picks).toHaveLength(6)
  })
})

describe('the taste cards', () => {
  async function toCards() {
    renderOnboarding()
    click('Find my first story')
    await screen.findByRole('heading', { name: /in the mood for/ })
    click('Eerie')
    click('Cozy')
    click('Next')
    return screen.findByRole('heading', { name: /catch your eye/ })
  }

  it('shows 8 works with cover, title, minutes and the genuine first line', async () => {
    await toCards()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(8)
    const first = cards[0]
    expect(within(first).getByText(/^Work \d+$/)).toBeInTheDocument()
    expect(within(first).getByText(/^\d+ min$/)).toBeInTheDocument()
    expect(
      within(first).getByText(/The genuine first line of work \d+\./),
    ).toBeInTheDocument()
    expect(first.querySelector('img')).not.toBeNull()
    expect(
      within(first)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('value')),
    ).toEqual(['love', 'maybe', 'notForMe'])
  })

  it('names each answer group after its work, for screen readers', async () => {
    await toCards()
    const groups = screen.getAllByRole('group')
    expect(groups[0]).toHaveAccessibleName(/^Your reaction to Work \d+$/)
  })

  it('records the answers as events, and ends on Your Shortlist', async () => {
    await toCards()
    const cards = screen.getAllByRole('listitem')
    fireEvent.click(within(cards[0]).getByRole('radio', { name: 'Love' }))
    fireEvent.click(within(cards[1]).getByRole('radio', { name: 'Not for me' }))
    fireEvent.click(within(cards[2]).getByRole('radio', { name: 'Maybe' }))
    const ids = cards.slice(0, 3).map((li) => li.textContent)
    expect(ids.every(Boolean)).toBe(true)
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

    const onboard = stores.events.filter((e) => e.type === 'onboard')
    expect(onboard.map((e) => e.reason)).toEqual([
      'start',
      'mood:eerie',
      'mood:cozy',
      'love',
      'notForMe',
      'maybe',
    ])
    const profile = (await stores.profileStore.get())!
    expect(profile.ladderLevel).toBe(2) // commute (0) and weekends (3), averaged
    expect((await stores.settingsStore.get()).shortlist?.picks).toHaveLength(6)
  })

  it('Skip setup on the cards ends at once and drops the answers', async () => {
    await toCards()
    const cards = screen.getAllByRole('listitem')
    fireEvent.click(within(cards[0]).getByRole('radio', { name: 'Love' }))
    await act(async () => {
      click('Skip setup')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect(stores.events.filter((e) => e.type === 'onboard')).toHaveLength(1)
    expect((await stores.profileStore.get())?.facetBeliefs).toEqual({})
  })
})

describe('the reading context', () => {
  it('can be skipped, and then sets no length preference', async () => {
    renderOnboarding()
    click('Find my first story')
    await screen.findByRole('heading', { name: /in the mood for/ })
    click('Eerie')
    click('Cozy')
    click('Next')
    await screen.findByRole('heading', { name: /catch your eye/ })
    click('Next')
    await screen.findByRole('heading', { name: 'When do you usually read?' })
    await act(async () => {
      click('Skip')
    })
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect((await stores.profileStore.get())?.ladderLevel).toBe(0)
  })

  it('allows several choices, and Back returns to the cards', async () => {
    renderOnboarding()
    click('Find my first story')
    await screen.findByRole('heading', { name: /in the mood for/ })
    click('Eerie')
    click('Cozy')
    click('Next')
    await screen.findByRole('heading', { name: /catch your eye/ })
    click('Next')
    await screen.findByRole('heading', { name: 'When do you usually read?' })
    for (const name of ['Commute', 'Lunch break', 'Evenings']) {
      fireEvent.click(screen.getByRole('checkbox', { name }))
    }
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3)
    click('Back')
    expect(
      await screen.findByRole('heading', { name: /catch your eye/ }),
    ).toBeInTheDocument()
  })
})
