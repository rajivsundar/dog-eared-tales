import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { startApp, mapProfileDb } from './helpers'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

async function goTab(page: Page, name: 'Library' | 'Settings' | 'Shortlist') {
  await nav(page).getByRole('link', { name }).click()
}

/** Dog-ears the first story on Your Shortlist and returns its title. */
async function dogEarFirst(page: Page): Promise<string> {
  const card = page.getByRole('listitem').first()
  const title = (await card.locator('span.font-serif').innerText()).trim()
  await card.getByRole('button').click()
  await page.getByRole('button', { name: 'Dog-ear', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dog-eared' })).toBeEnabled()
  await page.keyboard.press('Escape')
  return title
}

async function dogEared(page: Page) {
  await goTab(page, 'Library')
  await page.getByRole('tab', { name: /Dog-eared/ }).click()
}

async function addProfile(page: Page, name: string) {
  await goTab(page, 'Settings')
  await page.getByRole('button', { name: 'Add a profile' }).click()
  const form = page.getByRole('form', { name: 'Add a profile' })
  await form.getByLabel('Name').fill(name)
  await form.getByRole('button', { name: 'Add profile' }).click()
  // The new profile starts with the welcome and onboarding.
  await page.getByRole('button', { name: 'Pick my moods first' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('listitem')).toHaveCount(6)
}

test.beforeEach(async ({ page }) => {
  await mapProfileDb(page)
})

test('add a profile, onboard it, switch back, use the guest, delete a profile', async ({
  page,
}) => {
  await startApp(page)
  // One profile: no "Reading as" control and no dot.
  await expect(page.getByText(/Reading as/)).toHaveCount(0)
  await expect(nav(page).getByRole('img')).toHaveCount(0)
  const title = await dogEarFirst(page)

  // Add Sam, onboard, and see an empty Library.
  await addProfile(page, 'Sam')
  await expect(
    page.getByRole('button', { name: /Reading as Sam/ }),
  ).toBeVisible()
  await expect(
    nav(page).getByRole('img', { name: 'Reading as Sam' }),
  ).toBeVisible()
  await dogEared(page)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(
    0,
  )

  // Switch back through the quick switcher and see the other profile's data.
  await goTab(page, 'Shortlist')
  await page.getByRole('button', { name: /Reading as Sam/ }).click()
  await page
    .getByRole('group', { name: 'Switch profile' })
    .getByRole('button', { name: /^Me/ })
    .click()
  await expect(
    page.getByRole('button', { name: /Reading as Me/ }),
  ).toBeVisible()
  await dogEared(page)
  await expect(
    page.getByRole('link', { name: new RegExp(title) }),
  ).toBeVisible()

  // The guest: no onboarding, survives a reload, ends on switching back.
  await goTab(page, 'Shortlist')
  await page.getByRole('button', { name: /Reading as Me/ }).click()
  await page.getByRole('button', { name: /Read as guest/ }).click()
  await expect(
    page.getByRole('button', { name: /Reading as Guest/ }),
  ).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Reading as Guest/ }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      async () =>
        (await indexedDB.databases()).filter((d) =>
          d.name?.startsWith('twice-told-guest-'),
        ).length,
    ),
  ).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: /Reading as Guest/ }).click()
  await page
    .getByRole('group', { name: 'Switch profile' })
    .getByRole('button', { name: /^Me/ })
    .click()
  await expect(
    page.getByRole('button', { name: /Reading as Me/ }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          (await indexedDB.databases()).filter((d) =>
            d.name?.startsWith('twice-told-guest-'),
          ).length,
      ),
    )
    .toBe(0)

  // Delete Sam: typed DELETE, then only Me is left and the extras go away.
  await goTab(page, 'Settings')
  await page.getByRole('button', { name: 'Delete Sam' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Sam' })
  await expect(
    dialog.getByRole('button', { name: 'Delete Sam' }),
  ).toBeDisabled()
  await dialog.getByLabel(/Type DELETE/).fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete Sam' }).click()
  await expect(page.getByText('Deleted Sam.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Me' })).toBeDisabled()
  await goTab(page, 'Shortlist')
  await expect(page.getByText(/Reading as/)).toHaveCount(0)
})

test('Who’s reading? opens a new browser session when there are 2+ profiles', async ({
  page,
}) => {
  await startApp(page)
  await addProfile(page, 'Sam')
  // A new tab is a new browser session.
  const second = await page.context().newPage()
  await mapProfileDb(second)
  await second.goto('/library')
  await expect(
    second.getByRole('heading', { name: 'Who’s reading?' }),
  ).toBeVisible()
  await expect(second.getByText(/Last used/)).toBeVisible()
  await second.getByRole('button', { name: /^Me/ }).click()
  // On to the page that was asked for.
  await expect(second).toHaveURL(/\/library/)
  await expect(
    second.getByRole('button', { name: 'Reading as Me' }),
  ).toHaveCount(0) // that control is on Your Shortlist only
  await second.goto('/')
  await expect(
    second.getByRole('button', { name: /Reading as Me/ }),
  ).toBeVisible()
  // The first tab keeps its own profile, even after a reload: each tab remembers its own.
  await goTab(page, 'Library')
  await goTab(page, 'Shortlist')
  await expect(
    page.getByRole('button', { name: /Reading as Sam/ }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Reading as Sam/ }),
  ).toBeVisible()
})

test('an existing reader’s data moves into the profile "Me", and the old database goes', async ({
  page,
}) => {
  // Make the database an earlier version of the app would have left behind.
  await page.goto('/robots.txt')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('twice-told', 10)
        open.onerror = () => reject(open.error)
        open.onupgradeneeded = () => {
          const db = open.result
          db.createObjectStore('profile', { keyPath: 'id' })
          const events = db.createObjectStore('events', { keyPath: 'id' })
          events.createIndex('workId', 'workId')
          events.createIndex('at', 'at')
          const library = db.createObjectStore('library', {
            keyPath: 'workId',
          })
          library.createIndex('addedAt', 'addedAt')
          const progress = db.createObjectStore('progress', {
            keyPath: 'workId',
          })
          progress.createIndex('updatedAt', 'updatedAt')
          const highlights = db.createObjectStore('highlights', {
            keyPath: 'id',
          })
          highlights.createIndex('workId', 'workId')
          db.createObjectStore('settings', { keyPath: 'id' })
        }
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['events', 'library'], 'readwrite')
          tx.objectStore('events').put({
            id: 'old-event',
            workId: 'pg-1063-the-cask-of-amontillado',
            type: 'open',
            at: 1,
          })
          tx.objectStore('library').put({
            workId: 'pg-1063-the-cask-of-amontillado',
            shelf: 'default',
            addedAt: 5,
            offline: false,
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
  )

  await page.goto('/')
  // Not a first-time reader: the shortlist, not the welcome.
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(page.getByText(/Reading as/)).toHaveCount(0)
  await goTab(page, 'Settings')
  await expect(page.getByText('Me', { exact: true }).first()).toBeVisible()
  // The old story is still dog-eared.
  await dogEared(page)
  await expect(
    page.getByRole('link', { name: /The Cask of Amontillado/ }),
  ).toBeVisible()
  // The old database is gone; exactly one profile database exists.
  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  )
  expect(names).not.toContain('twice-told')
  expect(names.filter((n) => n?.startsWith('twice-told-p-'))).toHaveLength(1)
})
