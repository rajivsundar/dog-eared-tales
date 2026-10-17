import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { startApp, mapProfileDb } from './helpers'

/** Writes events straight into the app's IndexedDB, as if the reader had done these things. */
function addEvents(
  page: Page,
  events: { workId: string; type: string; value?: number; at: number }[],
): Promise<void> {
  return page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('profile-db')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('events', 'readwrite')
          for (const e of list) {
            tx.objectStore('events').put({ ...e, id: crypto.randomUUID() })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    events,
  )
}

test.beforeEach(async ({ page }) => {
  await mapProfileDb(page)
})

test('Your Long List appears after 3 positive finishes, with sittings', async ({
  page,
}) => {
  await startApp(page)
  // Nothing yet: no empty section either.
  await expect(
    page.getByRole('heading', { name: 'Your Long List' }),
  ).toHaveCount(0)

  const now = Date.now()
  const read = [
    'pg-269-the-open-window',
    'pg-1063-the-cask-of-amontillado',
    'pg-375-an-occurrence-at-owl-creek-bridge',
  ]
  await addEvents(page, [
    ...read.flatMap((workId, i) => [
      { workId, type: 'finished', at: now - 60_000 + i * 10 },
      { workId, type: 'love', at: now - 59_000 + i * 10 },
    ]),
    // Three real sessions of 20 minutes each.
    ...[0, 1, 2].map((i) => ({
      workId: read[0],
      type: 'session',
      value: 1200,
      at: now - 50_000 + i,
    })),
  ])
  await page.reload()

  const heading = page.getByRole('heading', { name: 'Your Long List' })
  await expect(heading).toBeVisible()
  const section = page.locator('section', { has: heading })
  const cards = section.getByRole('listitem')
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(4)
  await expect(cards.first()).toContainText(/About \d+ sittings? of 20 min/)
  await expect(cards.first().locator('img')).toBeVisible()

  // It sits below Your Shortlist, and none of its works is also on the shortlist.
  const shortSection = page.locator('section', {
    has: page.getByRole('heading', { name: /Shortlist/ }),
  })
  const shortTitles = await shortSection
    .locator('span.font-serif')
    .allInnerTexts()
  const longTitles = await section.locator('span.font-serif').allInnerTexts()
  for (const title of longTitles) expect(shortTitles).not.toContain(title)

  // Tapping a card opens the detail sheet.
  await cards.first().getByRole('button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('content-notes')).toBeVisible()

  // The same list comes back after a reload.
  await page.keyboard.press('Escape')
  const before = await cards.allInnerTexts()
  await page.reload()
  await expect(heading).toBeVisible()
  expect(
    await page
      .locator('section', { has: heading })
      .getByRole('listitem')
      .allInnerTexts(),
  ).toEqual(before)
})
