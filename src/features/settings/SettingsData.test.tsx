import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCatalogCache } from '../../catalog'
import { fakeCacheStorage } from '../../pwa/fakeCaches'
import { setDeferredPromptForTest } from '../../pwa/install'
import { TEXTS_CACHE } from '../../pwa/textCache'
import { BACKUP_SCHEMA_VERSION } from '../../stores/backup'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import { SettingsScreen } from './SettingsScreen'

const h = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import('../shortlist/fakeStores').fakeStores
  >,
}))
vi.mock('../../stores', async () => {
  const backup = await import('../../stores/backup')
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

describe('Settings → Your data: export', () => {
  it('downloads one JSON file named with the date, holding every store and a schema version', async () => {
    await stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 5 })
    await stores.libraryStore.save('story-2')
    const downloads = captureDownloads()
    renderSettings()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export my data' }))
    })
    expect(downloads).toHaveLength(1)
    expect(downloads[0].name).toMatch(
      /^twice-told-backup-\d{4}-\d{2}-\d{2}\.json$/,
    )
    const file = JSON.parse(await downloads[0].blob.text())
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
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
    expect(screen.getByRole('status')).toHaveTextContent(
      /Saved twice-told-backup-/,
    )
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

  it('asks before restoring, then replaces everything with the backup', async () => {
    await stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 5 })
    await stores.libraryStore.save('story-2')
    const backup = await stores.dataStore.exportAll()
    // Change things after the backup was made.
    await stores.eventLog.append({ workId: 'story-9', type: 'open', at: 9 })
    await stores.libraryStore.save('story-8')

    renderSettings()
    await chooseFile(backupFile(backup))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Restore this backup',
    })
    // Nothing changes until it is confirmed.
    expect(stores.events).toHaveLength(2)
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Yes, replace my data' }),
      )
    })
    expect(stores.events.map((e) => e.workId)).toEqual(['story-1'])
    expect([...stores.library.keys()]).toEqual(['story-2'])
    expect(await screen.findByText('HOME')).toBeInTheDocument()
  })

  it('Cancel leaves everything as it was', async () => {
    const backup = await stores.dataStore.exportAll()
    await stores.eventLog.append({ workId: 'story-9', type: 'open', at: 9 })
    renderSettings()
    await chooseFile(backupFile(backup))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(stores.events).toHaveLength(1)
  })

  it('refuses a backup from a newer schema version, and asks nothing', async () => {
    await stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 5 })
    const backup = await stores.dataStore.exportAll()
    renderSettings()
    await chooseFile(
      backupFile({ ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /newer version of Twice Told/,
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(stores.events).toHaveLength(1)
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
    await stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 5 })
    await stores.eventLog.append({ workId: 'story-1', type: 'love', at: 6 })
    await stores.libraryStore.save('story-2', { addedAt: 77 })
    await stores.progressStore.set({
      workId: 'story-3',
      locator: 'cfi',
      percent: 20,
      secondsRead: 90,
    })
    await stores.settingsStore.update({ theme: 'night' })
    const downloads = captureDownloads()
    const before = await stores.dataStore.exportAll()

    renderSettings()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export my data' }))
    })
    const file = new File([await downloads[0].blob.text()], downloads[0].name)

    // Delete all my data.
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    fireEvent.change(screen.getByLabelText(/Type DELETE/), {
      target: { value: 'DELETE' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    })
    expect(stores.events).toHaveLength(0)
    expect(stores.library.size).toBe(0)
    expect(await screen.findByText('WELCOME')).toBeInTheDocument()

    // Import the file back.
    cleanup()
    renderSettings()
    await chooseFile(file)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Yes, replace my data' }),
      )
    })
    const after = await stores.dataStore.exportAll()
    expect({ ...after, exportedAt: '' }).toEqual({ ...before, exportedAt: '' })
  })
})

function cleanup() {
  document.body.innerHTML = ''
}

describe('Settings → Your data: delete all my data', () => {
  async function seed() {
    await stores.eventLog.append({ workId: 'story-1', type: 'finished', at: 5 })
    await stores.libraryStore.save('story-2')
    await stores.profileStore.put({
      id: 'profile',
      tasteVector: [],
      facetBeliefs: { 'mood:eerie': { success: 3, failure: 0 } },
      ladderLevel: 0,
      wordsPerMinute: 238,
      version: 2,
    })
    await stores.settingsStore.update({ theme: 'night' })
  }

  it('needs DELETE typed exactly before it does anything', async () => {
    await seed()
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    const confirm = screen.getByRole('button', { name: 'Delete everything' })
    const input = screen.getByLabelText(/Type DELETE/)
    expect(confirm).toBeDisabled()
    for (const wrong of ['delete', 'DELET', 'DELETE ', 'Delete', '']) {
      fireEvent.change(input, { target: { value: wrong } })
      expect(confirm, JSON.stringify(wrong)).toBeDisabled()
    }
    expect(stores.events).toHaveLength(1)
    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(confirm).toBeEnabled()
  })

  it('wipes every store and the saved books, then starts onboarding', async () => {
    await seed()
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
    expect(await stores.profileStore.get()).toBeUndefined()
    expect(stores.events).toHaveLength(0)
    expect(stores.library.size).toBe(0)
    expect((await stores.settingsStore.get()).theme).toBe('system')
    expect(deleted).toEqual([TEXTS_CACHE])
    expect(await screen.findByText('WELCOME')).toBeInTheDocument()
  })

  it('Cancel changes nothing', async () => {
    await seed()
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all my data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText(/Type DELETE/)).not.toBeInTheDocument()
    expect(stores.events).toHaveLength(1)
  })
})
