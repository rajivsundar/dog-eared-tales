import { expect, test } from '@playwright/test'
import { startApp } from './helpers'

/** Reads every record in one of the app's IndexedDB stores. */
function readStore(
  page: import('@playwright/test').Page,
  store: 'events' | 'settings' | 'profile',
): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('twice-told')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains(name)) {
            db.close()
            resolve([])
            return
          }
          const all = db.transaction(name).objectStore(name).getAll()
          all.onsuccess = () => {
            db.close()
            resolve(all.result)
          }
          all.onerror = () => reject(all.error)
        }
      }),
    store,
  )
}

test('a fresh browser goes through onboarding to Your Shortlist', async ({
  page,
}) => {
  // 1. Welcome.
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(
    page.getByRole('heading', { name: 'Twice Told', level: 1 }),
  ).toBeFocused()
  await expect(
    page.getByText(
      'Great free stories, picked for you. Start short. Fall for the classics.',
    ),
  ).toBeVisible()
  await expect(
    page.getByText('Your reading data stays on this device'),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Find my first story' }).click()

  // 2. Mood board: 12 tiles, Next waits for 2.
  await expect(
    page.getByRole('heading', { name: /in the mood for/ }),
  ).toBeFocused()
  const tiles = page.getByRole('group').getByRole('button')
  await expect(tiles).toHaveCount(12)
  const next = page.getByRole('button', { name: 'Next' })
  await expect(next).toBeDisabled()
  await expect(page.getByText(/Pick at least 2 moods/)).toBeVisible()
  await page.getByRole('button', { name: 'Eerie' }).click()
  await expect(next).toBeDisabled()
  // Keyboard: Tab to a tile and press Space.
  await page.getByRole('button', { name: 'Cozy' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Cozy' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(next).toBeEnabled()
  await next.click()

  // 3. Taste cards: 8 real works with a first line and three answers each.
  await expect(
    page.getByRole('heading', { name: /catch your eye/ }),
  ).toBeFocused()
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(8)
  await expect(cards.first().locator('blockquote')).not.toBeEmpty()
  await expect(cards.first().locator('img')).toBeVisible()
  const title = (await cards.first().locator('p').first().innerText()).trim()
  await cards.first().getByText('Love', { exact: true }).click()
  await cards.nth(1).getByText('Not for me', { exact: true }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  // 4. Reading context, several choices.
  await expect(
    page.getByRole('heading', { name: 'When do you usually read?' }),
  ).toBeFocused()
  await page.getByRole('checkbox', { name: 'Commute' }).check({ force: true })
  await page.getByRole('checkbox', { name: 'Evenings' }).check({ force: true })
  await page.getByRole('button', { name: 'Show me my shortlist' }).click()

  // 5. Your Shortlist, with a Loved card on it.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(
    page.getByRole('listitem').filter({ hasText: title }),
  ).toHaveCount(1)

  // The answers are in the event log, and a profile exists.
  // getAll() returns records by id, so put them in time order first.
  const events = (await readStore(page, 'events'))
    .filter((e) => e.type === 'onboard')
    .sort((a, b) => (a.at as number) - (b.at as number))
  const reasons = events.map((e) => e.reason)
  expect(reasons[0]).toBe('start')
  expect(reasons).toEqual(
    expect.arrayContaining(['mood:eerie', 'mood:cozy', 'love', 'notForMe']),
  )
  expect(await readStore(page, 'profile')).toHaveLength(1)

  // Coming back later does not show onboarding again.
  await page.goto('/')
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(page).toHaveURL(/\/$/)
})

test('Skip goes to the taste cards, and Skip setup ends at once', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Find my first story' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('listitem')).toHaveCount(8)
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  const events = await readStore(page, 'events')
  expect(events.filter((e) => e.type === 'onboard')).toHaveLength(1)
})

test('Redo onboarding in Settings re-runs the flow and keeps reading history', async ({
  page,
}) => {
  await startApp(page)
  const before = await readStore(page, 'events')
  expect(before.length).toBeGreaterThan(0)

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click()
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
  await expect(page.getByText(/stories worth telling again/)).toBeVisible()
  await page.getByRole('link', { name: 'Redo onboarding' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByRole('button', { name: 'Find my first story' }).click()
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(6)

  const after = await readStore(page, 'events')
  const ids = new Set(after.map((e) => e.id))
  for (const e of before) expect(ids.has(e.id as string)).toBe(true)
  expect(after.length).toBeGreaterThan(before.length)
})
