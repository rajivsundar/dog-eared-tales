import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { startApp, mapProfileDb } from './helpers'

function readEvents(page: Page): Promise<{ id: string; type: string }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('profile-db')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const all = db.transaction('events').objectStore('events').getAll()
          all.onsuccess = () => {
            db.close()
            resolve(all.result)
          }
        }
      }),
  )
}

async function gotoSettings(page: Page) {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click()
  await expect(page.getByRole('heading', { name: 'Your data' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await mapProfileDb(page)
})

test('export, delete everything, then import brings the data back', async ({
  page,
}, testInfo) => {
  await startApp(page)
  // Make some history: dog-ear the first story.
  await page.getByRole('listitem').first().getByRole('button').click()
  await page.getByRole('button', { name: 'Dog-ear', exact: true }).click()
  await page.keyboard.press('Escape')
  const eventsBefore = await readEvents(page)
  expect(eventsBefore.some((e) => e.type === 'save')).toBe(true)

  await gotoSettings(page)

  // Storage section.
  await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible()
  await expect(
    page.getByText('Protected from automatic clearing'),
  ).toBeVisible()
  await expect(page.getByTestId('space-used')).toBeVisible()
  await expect(page.getByTestId('saved-offline')).toBeVisible()

  // Export: one JSON file named with the date.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export my data' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^dog-eared-tales-backup-\d{4}-\d{2}-\d{2}\.json$/,
  )
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  expect(backup.schemaVersion).toBe(2)
  expect(backup.kind).toBe('profile')
  expect(backup.name).toBe('Me')
  expect(Object.keys(backup.stores).sort()).toEqual([
    'events',
    'highlights',
    'library',
    'profile',
    'progress',
    'settings',
  ])
  expect(backup.stores.events.length).toBe(eventsBefore.length)

  // Delete all my data: nothing happens until DELETE is typed.
  await page.getByRole('button', { name: 'Delete all my data' }).click()
  const confirm = page.getByRole('button', { name: 'Delete everything' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/Type DELETE/).fill('delete')
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/Type DELETE/).fill('DELETE')
  await confirm.click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(
    page.getByRole('button', { name: 'Pick my moods first' }),
  ).toBeVisible()
  expect(await readEvents(page)).toEqual([])

  // Import it back, after confirming.
  await page.goto('/settings')
  await page.getByTestId('import-file').setInputFiles(file)
  await expect(
    page.getByRole('alertdialog', { name: 'Import this backup' }),
  ).toBeVisible()
  expect(await readEvents(page)).toEqual([])
  await page.getByRole('button', { name: 'Replace this profile' }).click()
  // Replacing asks a second time.
  await expect(
    page.getByRole('alertdialog', { name: 'Replace this profile' }),
  ).toBeVisible()
  expect(await readEvents(page)).toEqual([])
  await page.getByRole('button', { name: 'Yes, replace this profile' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  const eventsAfter = await readEvents(page)
  expect(eventsAfter.map((e) => e.id).sort()).toEqual(
    eventsBefore.map((e) => e.id).sort(),
  )
})

test('a backup from a newer version is refused', async ({ page }) => {
  await startApp(page)
  await gotoSettings(page)
  const newer = JSON.stringify({
    app: 'dog-eared-tales',
    schemaVersion: 99,
    exportedAt: new Date().toISOString(),
    stores: {
      profile: [],
      events: [],
      library: [],
      progress: [],
      highlights: [],
      settings: [],
    },
  })
  await page.getByTestId('import-file').setInputFiles({
    name: 'future.json',
    mimeType: 'application/json',
    buffer: Buffer.from(newer),
  })
  await expect(page.getByRole('alert')).toContainText(/newer version/)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})

test('the install option stays hidden when it cannot apply', async ({
  page,
}) => {
  // Headless Chromium offers no install prompt, so there is no Install section.
  await startApp(page)
  await gotoSettings(page)
  await expect(page.getByRole('heading', { name: 'Install' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
})
