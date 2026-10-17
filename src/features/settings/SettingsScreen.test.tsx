import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import { SettingsScreen } from './SettingsScreen'

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

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsScreen />
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
})
afterEach(() => vi.unstubAllGlobals())

describe('Your taste', () => {
  it('says there is nothing yet for a new reader', async () => {
    renderSettings()
    expect(await screen.findAllByText('Nothing yet.')).toHaveLength(2)
  })

  it('lists the top moods and genres learned from ratings', async () => {
    // story-1 is eerie in the test catalog.
    await stores.eventLog.append({ workId: 'story-1', type: 'finished' })
    await stores.eventLog.append({ workId: 'story-1', type: 'love' })
    renderSettings()
    const moods = (await screen.findByText('Top moods')).parentElement!
    expect(within(moods).getByText('eerie')).toBeInTheDocument()
    const genres = screen.getByText('Top genres').parentElement!
    expect(within(genres).getByText('literary')).toBeInTheDocument()
  })

  it('Reset asks first, then clears the taste without editing the event log', async () => {
    await stores.eventLog.append({ workId: 'story-1', type: 'finished' })
    await stores.eventLog.append({ workId: 'story-1', type: 'love' })
    await stores.profileStore.put({
      id: 'profile',
      tasteVector: [],
      facetBeliefs: { 'mood:eerie': { success: 3, failure: 0 } },
      ladderLevel: 0,
      wordsPerMinute: 238,
      version: 2,
    })
    renderSettings()
    await screen.findByText('eerie')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    // Cancel changes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(stores.events.some((e) => e.type === 'reset')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, reset' }))
    })
    expect(stores.events.filter((e) => e.type === 'reset')).toHaveLength(1)
    expect(stores.events.filter((e) => e.type === 'love')).toHaveLength(1)
    expect(await stores.profileStore.get()).toBeUndefined()
    expect(await screen.findAllByText('Nothing yet.')).toHaveLength(2)
  })
})

describe('About', () => {
  it('shows the line from CONTEXT.md and a Redo onboarding link', async () => {
    renderSettings()
    expect(
      screen.getByRole('heading', { name: 'About', level: 2 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Named after Nathaniel Hawthorne’s Twice-Told Tales (1837) — stories worth telling again.',
      ),
    ).toBeInTheDocument()
    const redo = screen.getByRole('link', { name: 'Redo onboarding' })
    expect(redo).toHaveAttribute('href', '/welcome?redo=1')
    // Following it records nothing and deletes nothing.
    await stores.eventLog.append({ workId: 'story-1', type: 'finished' })
    fireEvent.click(redo)
    expect(stores.events).toHaveLength(1)
  })
})

describe('Seasonal themes', () => {
  it('is on by default, can be turned off, and is remembered for this profile', async () => {
    renderSettings()
    const toggle = await screen.findByRole('switch', {
      name: /Seasonal themes/,
    })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    await vi.waitFor(async () =>
      expect((await stores.settingsStore.get()).seasonalThemes).toBe(false),
    )
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    await vi.waitFor(async () =>
      expect((await stores.settingsStore.get()).seasonalThemes).toBe(true),
    )
  })

  it('shows the saved choice when Settings opens again', async () => {
    await stores.settingsStore.update({ seasonalThemes: false })
    renderSettings()
    expect(
      await screen.findByRole('switch', { name: /Seasonal themes/ }),
    ).not.toBeChecked()
  })

  it('has a link to preview the welcome screen', async () => {
    renderSettings()
    expect(
      await screen.findByRole('link', { name: 'See the welcome screen' }),
    ).toHaveAttribute('href', '/welcome?preview=1')
  })
})
