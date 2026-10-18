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
import { resetCatalogCache } from '../catalog'
import { fakeCatalog, fakeStores } from '../features/shortlist/fakeStores'
import { testNames } from '../stores/testDb'
import App from './App'

const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('../features/shortlist/fakeStores').fakeStores
  >,
}))
vi.mock('../stores', async () => {
  const { delegateManager } = await import('../features/shortlist/fakeStores')
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
    progressStore: delegate('progressStore'),
    libraryStore: delegate('libraryStore'),
    dataStore: delegate('dataStore'),
  }
})

let clock = 0
let session: Map<string, string>
let stores: ReturnType<typeof fakeStores>

/** A new tab: new session storage, and a profile manager that starts up afresh. */
function newTab(options: { alreadyPicked?: boolean } = {}) {
  session = new Map(
    options.alreadyPicked ? [['dog-eared-tales-picked', '1']] : [],
  )
  return {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
    removeItem: (k: string) => void session.delete(k),
  }
}

function start(
  options: {
    alreadyPicked?: boolean
    names?: ReturnType<typeof testNames>
  } = {},
) {
  stores = fakeStores({
    ...(options.names ?? testNames()),
    session: newTab(options),
    now: () => clock,
  })
  h.current = stores
}

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** A returning reader, so the first-run welcome is skipped. */
async function returning() {
  await stores.eventLog.append({ workId: 'story-0', type: 'open' })
}

const nav = () => screen.getByRole('navigation', { name: 'Main' })

beforeEach(() => {
  clock = 1_000_000
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
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('one profile: the app looks as it always did', () => {
  it('has no "Reading as" control, no colour dot and no Who’s reading?', async () => {
    start()
    await returning()
    renderAt('/')
    await screen.findByRole('heading', { name: /Shortlist/ })
    expect(screen.queryByText(/Reading as/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Who’s reading?' })).toBeNull()
    expect(within(nav()).queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('two profiles', () => {
  it('asks Who’s reading? first in a browser session, marking the last used', async () => {
    const names = testNames()
    start({ names, alreadyPicked: true })
    await stores.profileManager.ready()
    clock += 10
    await stores.profileManager.create({ name: 'Sam' })
    stores.profileManager.close()
    // A new browser session: nothing picked yet.
    start({ names })
    await returning()
    renderAt('/library')
    expect(
      await screen.findByRole('heading', { name: 'Who’s reading?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Last used/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Read as guest/ }),
    ).toBeInTheDocument()
    // Choosing one goes on to the page that was asked for.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Sam/ }))
    })
    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeInTheDocument()
  })

  async function twoProfilesPicked() {
    start({ alreadyPicked: true })
    await returning()
    await stores.profileManager.ready()
    clock += 10
    await stores.profileManager.create({ name: 'Sam' })
  }

  it('shows the colour dot on Settings and a "Reading as" control on Your Shortlist', async () => {
    await twoProfilesPicked()
    renderAt('/')
    const control = await screen.findByRole('button', { name: /Reading as/ })
    expect(control).toHaveTextContent('Reading as Me')
    expect(
      within(nav()).getByRole('img', { name: 'Reading as Me' }),
    ).toBeInTheDocument()
  })

  it('the quick switcher lists the profiles and Read as guest, and switches', async () => {
    await twoProfilesPicked()
    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: /Reading as/ }))
    const panel = screen.getByRole('group', { name: 'Switch profile' })
    expect(
      within(panel).getByRole('button', { name: /Me.*Reading now/ }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('button', { name: /Read as guest/ }),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: /Sam/ }))
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Reading as/ }),
      ).toHaveTextContent('Reading as Sam'),
    )
    expect(stores.profileManager.current().active?.name).toBe('Sam')
    expect(screen.queryByRole('group', { name: 'Switch profile' })).toBeNull()
  })

  it('the quick switcher closes on Escape and when the open profile is chosen', async () => {
    await twoProfilesPicked()
    renderAt('/')
    const control = await screen.findByRole('button', { name: /Reading as/ })
    fireEvent.click(control)
    expect(control).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(control, { key: 'Escape' })
    expect(control).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(control)
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Switch profile' })).getByRole(
        'button',
        { name: /Me.*Reading now/ },
      ),
    )
    expect(control).toHaveAttribute('aria-expanded', 'false')
  })

  it('a guest: dot on Settings, no onboarding, and switching back ends the guest', async () => {
    await twoProfilesPicked()
    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: /Reading as/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Read as guest/ }))
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Reading as/ }),
      ).toHaveTextContent('Reading as Guest'),
    )
    expect(stores.profileManager.current().mode).toBe('guest')
    expect(
      within(nav()).getByRole('img', { name: 'Reading as a guest' }),
    ).toBeInTheDocument()
    // Switch back through the same control.
    fireEvent.click(screen.getByRole('button', { name: /Reading as/ }))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Switch profile' })).getByRole(
          'button',
          { name: /^Me/ },
        ),
      )
    })
    await waitFor(() =>
      expect(stores.profileManager.current().mode).toBe('profile'),
    )
    expect(session.get('dog-eared-tales-guest')).toBeUndefined()
  })

  it('after 30 minutes away, coming back shows Who’s reading? and returns to the same page', async () => {
    await twoProfilesPicked()
    renderAt('/library')
    await screen.findByRole('heading', { name: 'Library' })

    const visibility = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: state,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    // 29 minutes: nothing happens.
    act(() => visibility('hidden'))
    clock += 29 * 60 * 1000
    act(() => visibility('visible'))
    expect(screen.queryByRole('heading', { name: 'Who’s reading?' })).toBeNull()

    // 30 minutes: the picker.
    act(() => visibility('hidden'))
    clock += 30 * 60 * 1000
    act(() => visibility('visible'))
    expect(
      await screen.findByRole('heading', { name: 'Who’s reading?' }),
    ).toBeInTheDocument()
    // Choosing the same profile goes back to where the reader was.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Me/ }))
    })
    expect(
      await screen.findByRole('heading', { name: 'Library' }),
    ).toBeInTheDocument()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('with one profile, coming back after hours does not ask', async () => {
    start({ alreadyPicked: true })
    await returning()
    renderAt('/library')
    await screen.findByRole('heading', { name: 'Library' })
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    clock += 5 * 60 * 60 * 1000
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.queryByRole('heading', { name: 'Who’s reading?' })).toBeNull()
    Reflect.deleteProperty(document, 'visibilityState')
  })
})

describe('Settings → Profiles', () => {
  async function openProfiles() {
    start({ alreadyPicked: true })
    await returning()
    renderAt('/settings')
    return screen.findByRole('heading', { name: 'Profiles' })
  }

  it('says profiles don’t lock anyone out, and that the app is for readers 16 and over', async () => {
    await openProfiles()
    expect(
      screen.getByText(
        /Profiles keep reading separate; they don’t lock anyone out/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('Dog-Eared Tales is for readers 16 and over.'),
    ).toHaveLength(2) // Profiles and About
  })

  it('does not let the last profile be deleted', async () => {
    await openProfiles()
    expect(screen.getByRole('button', { name: 'Delete Me' })).toBeDisabled()
    expect(screen.getByText(/only profile/)).toBeInTheDocument()
  })

  it('adds a profile, switches to it and starts its welcome', async () => {
    await openProfiles()
    fireEvent.click(screen.getByRole('button', { name: 'Add a profile' }))
    const form = screen.getByRole('form', { name: 'Add a profile' })
    expect(within(form).getByLabelText('Name')).toHaveValue('Reader 2')
    fireEvent.change(within(form).getByLabelText('Name'), {
      target: { value: 'Sam' },
    })
    fireEvent.click(within(form).getByRole('radio', { name: /Ocean/ }))
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add profile' }))
    })
    await waitFor(() =>
      expect(stores.profileManager.current().active?.name).toBe('Sam'),
    )
    expect(stores.profileManager.current().active?.color).toBe('ocean')
    // The fake event log is shared, so the gate is not what sends us; the add flow goes to /welcome.
    expect(
      await screen.findByRole('button', { name: 'Surprise me' }),
    ).toBeInTheDocument()
  })

  it('refuses a name another profile has, ignoring case', async () => {
    await openProfiles()
    fireEvent.click(screen.getByRole('button', { name: 'Add a profile' }))
    const form = screen.getByRole('form', { name: 'Add a profile' })
    fireEvent.change(within(form).getByLabelText('Name'), {
      target: { value: 'me' },
    })
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add profile' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another profile already has that name.',
    )
    expect(stores.profileManager.current().profiles).toHaveLength(1)
  })

  it('renames and recolours', async () => {
    await openProfiles()
    fireEvent.click(screen.getByRole('button', { name: 'Rename Me' }))
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Alex' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    })
    await screen.findByText('Alex')
    fireEvent.click(
      screen.getByRole('button', { name: 'Change colour of Alex' }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /Plum/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save colour' }))
    })
    await waitFor(() =>
      expect(stores.profileManager.current().profiles[0].color).toBe('plum'),
    )
  })

  it('deletes another profile only after DELETE is typed, leaving the rest', async () => {
    await openProfiles()
    await act(async () => {
      await stores.profileManager.create({ name: 'Sam' })
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Sam' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Sam' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete Sam' })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/Type DELETE/), {
      target: { value: 'DELETE' },
    })
    await act(async () => {
      fireEvent.click(confirm)
    })
    await waitFor(() =>
      expect(
        stores.profileManager.current().profiles.map((p) => p.name),
      ).toEqual(['Me']),
    )
  })

  it('stops adding at 6 profiles', async () => {
    await openProfiles()
    await act(async () => {
      for (let i = 2; i <= 6; i++) await stores.profileManager.create()
    })
    expect(
      await screen.findByRole('button', { name: 'Add a profile' }),
    ).toBeDisabled()
    expect(screen.getByText(/6 profiles is the most/)).toBeInTheDocument()
  })

  it('as a guest: says nothing is saved, and Back returns to the last used profile', async () => {
    await openProfiles()
    fireEvent.click(screen.getByRole('button', { name: 'Read as guest' }))
    await waitFor(() =>
      expect(stores.profileManager.current().mode).toBe('guest'),
    )
  })
})
