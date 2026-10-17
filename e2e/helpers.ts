import { type APIRequestContext, type Page, expect } from '@playwright/test'

/** How many entries the built catalog ships (read from the catalog the app serves). */
export async function shippedCount(
  request: APIRequestContext,
): Promise<number> {
  const response = await request.get('/catalog/catalog.json')
  const file = (await response.json()) as { entries: unknown[] }
  return file.entries.length
}

/** Turns one page forward in the reader and waits until the position changes. */
export async function turnForward(page: Page): Promise<void> {
  const reader = page.getByTestId('reader')
  const before = (await reader.getAttribute('data-locator')) ?? ''
  // A key pressed while the previous page is still settling is ignored, so press again if needed.
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(250)
    if ((await reader.getAttribute('data-locator')) !== before) return
  }
  throw new Error('the page did not turn')
}

/** Waits for the reader to be ready on its first page. */
export async function waitForReader(page: Page): Promise<void> {
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).not.toHaveAttribute('data-locator', '')
}

/**
 * Opens the app as a returning reader. A fresh browser starts onboarding, so this skips it
 * (Pick my moods first, then Skip) and waits for Your Shortlist.
 */
export async function startApp(
  page: Page,
  /** The date the app sees: out of season by default, so no seasonal row. 'keep' leaves the clock alone. */
  date: Date | 'keep' = new Date(2026, 8, 16, 11, 0),
): Promise<void> {
  await mapProfileDb(page)
  if (date !== 'keep') await page.clock.setFixedTime(date)
  await page.goto('/')
  const welcome = page.getByRole('button', { name: 'Pick my moods first' })
  const cards = page
    .getByRole('region', { name: /Shortlist/ })
    .getByRole('listitem')
  await expect(welcome.or(cards.first())).toBeVisible()
  if (await welcome.isVisible()) {
    await welcome.click()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  }
  await expect(cards).toHaveCount(6)
}

/**
 * Specs read and write the reader's data with indexedDB.open('profile-db'). Reading data now lives
 * in a database per profile, so this makes that name mean "the only profile's database".
 */
export async function mapProfileDb(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (name: string, version?: number) {
      if (name !== 'profile-db') return original.call(this, name, version)
      const request: Record<string, unknown> = {}
      void this.databases().then((list) => {
        const real = list
          .map((d) => d.name ?? '')
          .find((n) => n.startsWith('twice-told-p-'))
        const opening = original.call(this, real ?? 'twice-told-p-missing')
        opening.onsuccess = () => {
          request.result = opening.result
          ;(request.onsuccess as (() => void) | undefined)?.()
        }
        opening.onerror = () => {
          request.error = opening.error
          ;(request.onerror as (() => void) | undefined)?.()
        }
      })
      return request as unknown as IDBOpenDBRequest
    }
  })
}
