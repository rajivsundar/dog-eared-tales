import {
  waitFor,
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCacheStorage } from '../../pwa/fakeCaches'
import { setDeferredPromptForTest } from '../../pwa/install'
import { TEXTS_CACHE } from '../../pwa/textCache'
import { BACKUP_SCHEMA_VERSION } from '../../stores/backup'
import { createEventLog } from '../../stores/eventLog'
import { createLibraryStore } from '../../stores/libraryStore'
import { createProfileStore } from '../../stores/profileStore'
import { createProgressStore } from '../../stores/progressStore'
import { createSettingsStore } from '../../stores/settingsStore'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import { SettingsScreen } from './SettingsScreen'

const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('../shortlist/fakeStores').fakeStores
  >,
}))
vi.mock('../../stores', async () => {
  const backup = await import('../../stores/backup')
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
    ProfileError: (await import('../../stores/profileManager')).ProfileError,
    MAX_READING_PROFILES: 6,
    PROFILE_COLORS: (await import('../../stores/types')).PROFILE_COLORS,
    MAX_PROFILE_NAME: 20,
    eventLog: delegate('eventLog'),
    profileStore: delegate('profileStore'),
    settingsStore: delegate('settingsStore'),
    dataStore: delegate('dataStore'),
    BackupError: backup.BackupError,
    parseBackup: backup.parseBackup,
  }
})

let stores: ReturnType<typeof fakeStores>

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/welcome" element={<p>WELCOME</p>} />
        <Route path="/" element={<p>HOME</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function environment(
  options: { standalone?: boolean; userAgent?: string } = {},
) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && !!options.standalone,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: options.userAgent ?? 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
  })
}

/** Records downloads: the file name and the text. */
function captureDownloads() {
  const downloads: { name: string; blob: Blob }[] = []
  let blob: Blob | null = null
  // jsdom has no object URLs; add them to the real URL class (so new URL(...) still works).
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (b: Blob) => {
      blob = b
      return 'blob:test'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => {},
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: blob! })
  })
  return downloads
}

const backupFile = (backup: object) =>
  new File([JSON.stringify(backup)], 'backup.json', {
    type: 'application/json',
  })

beforeEach(() => {
  stores = fakeStores()
  h.current = stores
  resetCatalogCache()
  environment()
  setDeferredPromptForTest(null)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        entries: fakeCatalog().map((e, i) => ({
          ...e,
          textUrl: `/texts/pg-${i}.epub`,
        })),
      }),
    })),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(navigator, 'storage')
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('Settings → Storage', () => {
  it('shows whether the data is protected, the space used and the stories saved offline', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => true,
        estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 1e10 }),
      },
    })
    vi.stubGlobal(
      'caches',
      fakeCacheStorage({
        [TEXTS_CACHE]: [
          '/texts/pg-1.epub',
          '/texts/pg-3.epub',
          '/texts/zzz.epub',
        ],
      }).storage,
    )
    renderSettings()
    expect(await screen.findByTestId('persisted')).toHaveTextContent('Yes')
    expect(
      screen.getByText('Protected from automatic clearing'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('space-used')).toHaveTextContent('5.0 MB')
    // Two stories have their book saved (the third file is not a catalog story).
    expect(screen.getByTestId('saved-offline')).toHaveTextContent('2')
  })

  it('says No when the browser has not protected it', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => false,
        estimate: async () => ({ usage: 1024 * 1024 }),
      },
    })
    renderSettings()
    expect(await screen.findByTestId('persisted')).toHaveTextContent('No')
    expect(screen.getByTestId('saved-offline')).toHaveTextContent('0')
  })
})

describe('Settings → Install', () => {
  const event = () => {
    const e = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: string }>
    }
    e.prompt = vi.fn(async () => {})
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    return e
  }

  it('offers Install Twice Told when the browser gave us a prompt', async () => {
    setDeferredPromptForTest(event())
    renderSettings()
    expect(
      await screen.findByRole('heading', { name: 'Install' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Install Twice Told' }),
    ).toBeInTheDocument()
  })

  it('is hidden entirely when running standalone (already installed)', async () => {
    environment({ standalone: true })
    setDeferredPromptForTest(event())
    renderSettings()
    await screen.findByTestId('persisted').catch(() => {})
    expect(
      screen.queryByRole('heading', { name: 'Install' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Install Twice Told' }),
    ).not.toBeInTheDocument()
  })

  it('shows Share → Add to Home Screen steps on iPhone Safari', async () => {
    environment({ userAgent: IPHONE })
    renderSettings()
    expect(await screen.findByTestId('ios-install')).toHaveTextContent(
      'Add to Home Screen',
    )
  })

  it('shows no install section on a browser that cannot install', () => {
    renderSettings()
    expect(
      screen.queryByRole('heading', { name: 'Install' }),
    ).not.toBeInTheDocument()
  })
})

/** The reading data of the open profile, read and written through the real profile manager. */
function live() {
  const pm = stores.profileManager
  return {
    events: pm.forward(createEventLog),
    library: pm.forward(createLibraryStore),
    progress: pm.forward(createProgressStore),
    settings: pm.forward(createSettingsStore),
    profile: pm.forward(createProfileStore),
  }
}

describe('Settings → Your data: export', () => {
  it('with one profile: "Export my data" downloads one JSON file named with the date', async () => {
    const data = live()
    await data.events.append({ workId: 'story-1', type: 'finished', at: 5 })
    await data.library.save('story-2')
    const downloads = captureDownloads()
    renderSettings()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export my data' }))
    })
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(
      /^twice-told-backup-\d{4}-\d{2}-\d{2}\.json$/,
    )
    const file = JSON.parse(await downloads[0].blob.text())
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(file.kind).toBe('profile')
    expect(file.name).toBe('Me')
    expect(file.app).toBe('twice-told')
    expect(Object.keys(file.stores).sort()).toEqual([
      'events',
      'highlights',
      'library',
      'profile',
      'progress',
      'settings',
    ])
    expect(file.stores.events).toHaveLength(1)
    expect(file.stores.library[0].workId).toBe('story-2')
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Saved twice-told-backup-/,
    )
  })

  it('with 2+ profiles: "Export this profile" and "Export all profiles"', async () => {
    await stores.profileManager.create({ name: 'Sam' })
    const downloads = captureDownloads()
    renderSettings()
    expect(
      screen.queryByRole('button', { name: 'Export my data' }),
    ).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Export this profile' }),
      )
    })
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(/^twice-told-backup-me-\d{4}/)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Export all profiles' }),
      )
    })
    await waitFor(() => expect(downloads).toHaveLength(2))
    expect(downloads[1].name).toMatch(/^twice-told-all-profiles-\d{4}/)
    const all = JSON.parse(await downloads[1].blob.text())
    expect(all.kind).toBe('all')
    expect(all.profiles.map((p: { name: string }) => p.name)).toEqual([
      'Me',
      'Sam',
    ])
  })
})

describe('Settings → Your data: import', () => {
  async function chooseFile(file: File) {
    await act(async () => {
      fireEvent.change(screen.getByTestId('import-file'), {
        target: { files: [file] },
      })
    })
  }

  it('offers "Add as a new profile" first, and that is the default', async () => {
    const data = live()
    await data.library.save('story-2')
    const backup = await stores.profileManager.exportProfile()
    await data.library.save('story-8') // changed after the backup

    renderSettings()
    await chooseFile(backupFile(backup))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Import this backup',
    })
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Add as a new profile')
    expect(buttons[0]).toHaveFocus()
    expect(
      within(dialog).getByRole('button', { name: 'Replace this profile' }),
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(buttons[0])
    })
    // The open profile is untouched; a second profile now exists.
    await waitFor(() =>
      expect(stores.profileManager.current().profiles).toHaveLength(2),
    )
    expect(stores.profileManager.current().active?.name).toBe('Me')
    expect((await data.library.list()).map((w) => w.workId).sort()).toEqual([
      'story-2',
      'story-8',
    ])
    expect(stores.profileManager.current().profiles[1].name).toBe('Me (2)')
  })

  it('"Replace this profile" asks a second time, then replaces only the open profile', async () => {
    const data = live()
    await data.events.append({ workId: 'story-1', type: 'finished', at: 5 })
    await data.library.save('story-2')
    const backup = await stores.profileManager.exportProfile()
    await data.events.append({ workId: 'story-9', type: 'open', at: 9 })
    await data.library.save('story-8')

    renderSettings()
    await chooseFile(backupFile(backup))
    const first = await screen.findByRole('alertdialog', {
      name: 'Import this backup',
    })
    fireEvent.click(
      within(first).getByRole('button', { name: 'Replace this profile' }),
    )
    // The second confirmation. Nothing has changed yet.
    const second = screen.getByRole('alertdialog', {
      name: 'Replace this profile',
    })
    expect((await data.events.list()).map((e) => e.workId)).toEqual([
      'story-1',
      'story-9',
    ])
    await act(async () => {
      fireEvent.click(
        within(second).getByRole('button', {
          name: 'Yes, replace this profile',
        }),
      )
    })
    expect(await screen.findByText('HOME')).toBeInTheDocument()
    expect((await data.events.list()).map((e) => e.workId)).toEqual(['story-1'])
    expect((await data.library.list()).map((w) => w.workId)).toEqual([
      'story-2',
    ])
    expect(stores.profileManager.current().profiles).toHaveLength(1)
  })

  it('an all-profiles file asks once to replace everything', async () => {
    await stores.profileManager.create({ name: 'Sam' })
    const all = await stores.profileManager.exportAllProfiles()
    await stores.profileManager.create({ name: 'Extra' })

    renderSettings()
    await chooseFile(backupFile(all))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Restore this backup',
    })
    expect(dialog).toHaveTextContent('2 profiles')
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Yes, replace everything' }),
      )
    })
    expect(await screen.findByText('HOME')).toBeInTheDocument()
    expect(stores.profileManager.current().profiles.map((p) => p.name)).toEqual(
      ['Me', 'Sam'],
    )
  })

  it('Cancel leaves everything as it was', async () => {
    const data = live()
    const backup = await stores.profileManager.exportProfile()
    await data.events.append({ workId: 'story-9', type: 'open', at: 9 })
    renderSettings()
    await chooseFile(backupFile(backup))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await data.events.list()).toHaveLength(1)
    expect(stores.profileManager.current().profiles).toHaveLength(1)
  })

  it('refuses a backup from a newer schema version, and asks nothing', async () => {
    const backup = await stores.profileManager.exportProfile()
    renderSettings()
    await chooseFile(
      backupFile({ ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /newer version of Twice Told/,
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('still reads a version 1 file (from before profiles), adding it as "Imported"', async () => {
    const data = live()
    await data.library.save('story-2')
    const { stores: contents } = await stores.profileManager.exportProfile()
    const v1 = {
      app: 'twice-told',
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      stores: contents,
    }
    renderSettings()
    await chooseFile(backupFile(v1))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Import this backup',
    })
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Add as a new profile' }),
      )
    })
    await waitFor(() =>
      expect(
        stores.profileManager.current().profiles.map((p) => p.name),
      ).toEqual(['Me', 'Imported']),
    )
  })

  it('refuses a file that is not a backup', async () => {
    renderSettings()
    await chooseFile(new File(['this is not json'], 'notes.txt'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file is not a Twice Told backup.',
    )
    await chooseFile(backupFile({ hello: 'world' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file is not a Twice Told backup.',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('export → delete all → import gives identical data', async () => {
    const data = live()
    await data.events.append({ workId: 'story-1', type: 'finished', at: 5 })
    await data.events.append({ workId: 'story-1', type: 'love', at: 6 })
    await data.library.save('story-2', { addedAt: 77 })
    await data.progress.set({
      workId: 'story-3',
      locator: 'cfi',
      percent: 20,
      secondsRead: 90,
    })
    await data.settings.update({ theme: 'night' })
    const downloads = captureDownloads()
    const before = (await stores.profileManager.exportProfile()).stores
    const progressBefore = before.progress.map((p) => p.workId)

    renderSettings()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export my data' }))
    })
    await waitFor(() => expect(downloads).toHaveLength(1))
    const file = new File([await downloads[0].blob.text()], downloads[0].name)

    // Delete all my data.
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    fireEvent.change(screen.getByLabelText(/Type DELETE/), {
      target: { value: 'DELETE' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    })
    expect(await screen.findByText('WELCOME')).toBeInTheDocument()
    expect(await live().events.list()).toHaveLength(0)

    // Import the file back, replacing the (new, empty) profile.
    cleanup()
    renderSettings()
    await chooseFile(file)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Replace this profile' }),
    )
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Yes, replace this profile' }),
      )
    })
    await screen.findByText('HOME')
    const after = (await stores.profileManager.exportProfile()).stores
    expect(after).toEqual(before)
    expect(after.progress.map((p) => p.workId)).toEqual(progressBefore)
  })
})

function cleanup() {
  document.body.innerHTML = ''
}

describe('Settings → Your data: delete all my data', () => {
  async function seed() {
    const data = live()
    await data.events.append({ workId: 'story-1', type: 'finished', at: 5 })
    await data.library.save('story-2')
    await data.profile.put({
      id: 'profile',
      tasteVector: [],
      facetBeliefs: { 'mood:eerie': { success: 3, failure: 0 } },
      ladderLevel: 0,
      wordsPerMinute: 238,
      version: 2,
    })
    await data.settings.update({ theme: 'night' })
    return data
  }

  it('needs DELETE typed exactly before it does anything', async () => {
    const data = await seed()
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    const confirm = screen.getByRole('button', { name: 'Delete everything' })
    const input = screen.getByLabelText(/Type DELETE/)
    expect(confirm).toBeDisabled()
    for (const wrong of ['delete', 'DELET', 'DELETE ', 'Delete', '']) {
      fireEvent.change(input, { target: { value: wrong } })
      expect(confirm, JSON.stringify(wrong)).toBeDisabled()
    }
    expect(await data.events.list()).toHaveLength(1)
    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(confirm).toBeEnabled()
  })

  it('wipes every profile and the saved books, then starts a fresh "Me" with the welcome', async () => {
    const data = await seed()
    await stores.profileManager.create({ name: 'Sam' })
    const fake = fakeCacheStorage({
      [TEXTS_CACHE]: ['/texts/pg-1.epub', '/texts/pg-2.epub'],
    })
    vi.stubGlobal('caches', fake.storage)
    const deleted: string[] = []
    ;(
      fake.storage as unknown as { delete: (n: string) => Promise<boolean> }
    ).delete = async (name: string) => {
      deleted.push(name)
      return true
    }
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    fireEvent.change(screen.getByLabelText(/Type DELETE/), {
      target: { value: 'DELETE' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    })
    expect(await screen.findByText('WELCOME')).toBeInTheDocument()
    expect(await data.profile.get()).toBeUndefined()
    expect(await data.events.list()).toHaveLength(0)
    expect(await data.library.list()).toHaveLength(0)
    expect((await data.settings.get()).theme).toBe('system')
    expect(stores.profileManager.current().profiles.map((p) => p.name)).toEqual(
      ['Me'],
    )
    expect(deleted).toEqual([TEXTS_CACHE])
  })

  it('Cancel changes nothing', async () => {
    const data = await seed()
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText(/Type DELETE/)).not.toBeInTheDocument()
    expect(await data.events.list()).toHaveLength(1)
  })
})
