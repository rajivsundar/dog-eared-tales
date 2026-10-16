import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../catalog'
import { eventLog } from '../stores'
import App from './App'

// The app reads its theme from the settings store; the tests use a stand-in.
vi.mock('../stores', async () => {
  const { fakeStores } = await import('../features/shortlist/fakeStores')
  return fakeStores()
})

const entries = [
  {
    id: 'pg-1063-the-cask-of-amontillado',
    title: 'The Cask of Amontillado',
    author: 'Edgar Allan Poe',
    bookTitle: 'The Cask of Amontillado',
    isCollection: false,
    readingMinutes: 10,
  },
  {
    id: 'pg-1661-a-scandal-in-bohemia',
    title: 'A Scandal in Bohemia',
    author: 'Arthur Conan Doyle',
    bookTitle: 'The Adventures of Sherlock Holmes',
    isCollection: true,
    readingMinutes: 37,
  },
]

beforeEach(() => {
  resetCatalogCache()
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('sends a first-time reader (no profile, no events) to onboarding', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('button', { name: 'Pick my moods first' }),
    ).toBeInTheDocument()
    // Onboarding has no bottom navigation.
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })

  it('shows the name and tagline on the home page', async () => {
    // A returning reader: there is already something in the event log.
    await eventLog.append({ workId: 'x', type: 'open' })
    // These two stand-in stories are too bare for the recommender; that is not what this test checks.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Twice Told' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Great free stories, picked for you. Start short. Fall for the classics.',
      ),
    ).toBeInTheDocument()
    await screen.findByRole('heading', { name: /Shortlist/ })
    error.mockRestore()
  })

  it('lists every catalog entry at /all as a link to its reader', async () => {
    renderAt('/all')
    const link = await screen.findByRole('link', {
      name: /A Scandal in Bohemia/,
    })
    expect(link).toHaveAttribute('href', '/read/pg-1661-a-scandal-in-bohemia')
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(
      entries.length,
    )
    expect(
      screen.getByText(/from The Adventures of Sherlock Holmes/),
    ).toBeInTheDocument()
  })

  it('says so when the catalog cannot be loaded at /all', async () => {
    resetCatalogCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/all')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the stories.',
    )
    error.mockRestore()
  })

  it('shows the bottom navigation with the current tab marked', async () => {
    renderAt('/settings')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Shortlist', 'Library', 'Settings'])
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(nav).getByRole('link', { name: 'Library' }),
    ).not.toHaveAttribute('aria-current')
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('opens the Library from the navigation', async () => {
    renderAt('/')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('link', { name: 'Library' }))
    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    error.mockRestore()
  })

  it('shows a friendly page for an unknown address', () => {
    renderAt('/nowhere')
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
