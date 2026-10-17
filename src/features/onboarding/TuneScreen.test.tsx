import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import { TuneCard } from './TuneCard'
import TuneScreen from './TuneScreen'

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
        entries: Array.from({ length: 24 }, (_, i) => ({
          ...fakeCatalog()[i % 10],
          id: `w${i}`,
          title: `Work ${i}`,
          moods: [MOODS[i % 12]],
          form: i === 5 ? 'essay' : 'story',
          lengthClass: i % 3 === 0 ? 'under10' : '10to30',
        })),
      }),
    })),
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderTune() {
  return render(
    <MemoryRouter initialEntries={['/tune']}>
      <Routes>
        <Route path="/tune" element={<TuneScreen />} />
        <Route path="/" element={<p>YOUR SHORTLIST</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the Tune your picks card', () => {
  it('names itself, links to the taste cards and can be dismissed', () => {
    const onDismiss = vi.fn()
    render(
      <MemoryRouter>
        <TuneCard onDismiss={onDismiss} />
      </MemoryRouter>,
    )
    const card = screen.getByRole('region', { name: 'Tune your picks' })
    expect(
      within(card).getByRole('link', { name: 'Tune now' }),
    ).toHaveAttribute('href', '/tune')
    const dismiss = within(card).getByRole('button', {
      name: 'Dismiss Tune your picks',
    })
    expect(dismiss.className).toMatch(/min-h-11/)
    fireEvent.click(dismiss)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('the /tune screen', () => {
  it('shows 8 taste cards, focuses its heading, and offers Not now', async () => {
    renderTune()
    const heading = await screen.findByRole('heading', {
      name: 'Tune your picks',
    })
    expect(heading).toHaveFocus()
    expect(await screen.findAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByRole('link', { name: 'Not now' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getAllByRole('group')[0]).toHaveAccessibleName(
      /^Your reaction to /,
    )
  })

  it('draws the cards from the moods picked earlier', async () => {
    const { finishOnboarding } = await import('./finishOnboarding')
    const catalog = (await import('../../catalog')).loadCatalog
    await finishOnboarding(
      {
        catalog: await catalog(),
        events: stores.eventLog,
        profile: stores.profileStore,
        settings: stores.settingsStore,
      },
      { moods: ['eerie', 'cozy'], cards: {} },
    )
    resetCatalogCache()
    renderTune()
    const cards = await screen.findAllByRole('listitem')
    const titles = cards.map((c) => c.textContent ?? '')
    // w1 is eerie and w0 is cozy in the test catalog.
    expect(titles.some((t) => t.includes('Work 1'))).toBe(true)
    expect(titles.some((t) => t.includes('Work 0'))).toBe(true)
  })

  it('saves the answers as events with no new start marker, then rebuilds today’s shortlist', async () => {
    const { finishOnboarding } = await import('./finishOnboarding')
    const { loadCatalog } = await import('../../catalog')
    await finishOnboarding(
      {
        catalog: await loadCatalog(),
        events: stores.eventLog,
        profile: stores.profileStore,
        settings: stores.settingsStore,
      },
      { moods: ['eerie', 'cozy'], cards: {} },
    )
    resetCatalogCache()
    renderTune()
    const cards = await screen.findAllByRole('listitem')
    fireEvent.click(within(cards[0]).getByRole('radio', { name: 'Love' }))
    fireEvent.click(within(cards[1]).getByRole('radio', { name: 'Not for me' }))
    fireEvent.click(within(cards[2]).getByRole('radio', { name: 'Maybe' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update my picks' }))
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
      'maybe',
    ])
    const shortlist = (await stores.settingsStore.get()).shortlist!
    expect(shortlist.picks).toHaveLength(6)
    expect(shortlist.avoid).toHaveLength(1)
  })

  it('Not now changes nothing', async () => {
    renderTune()
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('link', { name: 'Not now' }))
    expect(await screen.findByText('YOUR SHORTLIST')).toBeInTheDocument()
    expect(stores.events).toHaveLength(0)
    expect(await stores.profileStore.get()).toBeUndefined()
  })
})
