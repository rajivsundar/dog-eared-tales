import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../catalog'
import App from './App'

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

describe('App', () => {
  it('shows the name and tagline', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Twice Told' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Great free stories, picked for you. Start short. Fall for the classics.',
      ),
    ).toBeInTheDocument()
    await screen.findByText('A Scandal in Bohemia')
  })

  it('lists every catalog entry as a link to its reader', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    const link = await screen.findByRole('link', {
      name: /A Scandal in Bohemia/,
    })
    expect(link).toHaveAttribute('href', '/read/pg-1661-a-scandal-in-bohemia')
    expect(screen.getAllByRole('link')).toHaveLength(entries.length)
    expect(
      screen.getByText(/from The Adventures of Sherlock Holmes/),
    ).toBeInTheDocument()
  })

  it('says so when the catalog cannot be loaded', async () => {
    resetCatalogCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the stories.',
    )
    error.mockRestore()
  })

  it('shows a friendly page for an unknown address', () => {
    render(
      <MemoryRouter initialEntries={['/nowhere']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
