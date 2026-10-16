import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { startApp } from './helpers'

/** Reads every record in one of the app's IndexedDB stores. */
function readStore(
  page: Page,
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

/** Onboarding events in time order (getAll() returns them by id). */
async function onboardReasons(page: Page): Promise<unknown[]> {
  return (await readStore(page, 'events'))
    .filter((e) => e.type === 'onboard')
    .sort((a, b) => (a.at as number) - (b.at as number))
    .map((e) => e.reason)
}

const MARCH = new Date(2026, 2, 3, 12)
const FALL = new Date(2026, 9, 16, 12)
const DEC_1 = new Date(2026, 11, 1, 12)

test.describe('the welcome page', () => {
  test('shows the headline, subline, trust line and a fan of 3 real covers', async ({
    page,
  }) => {
    await page.clock.setFixedTime(MARCH)
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByText('Twice Told', { exact: true })).toBeVisible()
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveText('Great free stories, picked for you.')
    await expect(h1).toBeFocused()
    await expect(
      page.getByText('Start short. Fall for the classics.'),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Free · No account · No ads · Your reading stays on your phone',
      ),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)

    const covers = page.getByTestId('cover-fan').locator('img')
    await expect(covers).toHaveCount(3)
    for (const cover of await covers.all()) {
      await expect(cover).toBeVisible()
      expect(
        await cover.evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBeGreaterThan(0)
    }

    await expect(
      page.getByRole('button', { name: 'Read a short story now' }),
    ).toBeVisible()
    await expect(page.getByTestId('featured-story')).toHaveText(
      'The Open Window · 5 min',
    )
  })

  test('"Why Twice Told?" reveals the Hawthorne line', async ({ page }) => {
    await page.goto('/')
    const line = page.getByText(/Named after Nathaniel Hawthorne/)
    await expect(line).toBeHidden()
    const why = page.getByRole('button', { name: /Why .Twice Told.\?/ })
    await why.click()
    await expect(why).toHaveAttribute('aria-expanded', 'true')
    await expect(line).toBeVisible()
    await why.click()
    await expect(line).toBeHidden()
  })

  test('has two columns on a desktop and stacks on a 360 px phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const art = page.getByTestId('cover-fan')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    let a = (await art.boundingBox())!
    let h = (await heading.boundingBox())!
    expect(a.x + a.width).toBeLessThanOrEqual(h.x + 1) // art is left of the text
    expect(Math.abs(a.y + a.height / 2 - (h.y + h.height / 2))).toBeLessThan(
      300,
    )

    await page.setViewportSize({ width: 360, height: 740 })
    a = (await art.boundingBox())!
    h = (await heading.boundingBox())!
    expect(a.y + a.height).toBeLessThanOrEqual(h.y + 1) // art is above the text
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    for (const button of await page.getByRole('button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('is the fall version on Oct 16 and the default version on Dec 1', async ({
    page,
  }) => {
    await page.clock.setFixedTime(FALL)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fall for the classics.',
    )
    await expect(
      page.getByText('Great free stories, picked for you. Start short.'),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Turn over a new leaf' }),
    ).toBeVisible()
    await expect(page.getByTestId('featured-story')).toContainText(
      'The Tell-Tale Heart',
    )
    const srcs = await page
      .getByTestId('cover-fan')
      .locator('img')
      .evaluateAll((imgs) =>
        imgs.map((i) => (i as HTMLImageElement).getAttribute('src')),
      )
    expect(srcs).toEqual([
      '/covers/pg-2148-the-tell-tale-heart.svg',
      '/covers/pg-932-the-fall-of-the-house-of-usher.svg',
      '/covers/pg-14522-the-canterville-ghost.svg',
    ])

    await page.clock.setFixedTime(DEC_1)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Great free stories, picked for you.',
    )
    await expect(
      page.getByRole('button', { name: 'Read a short story now' }),
    ).toBeVisible()
  })
})

test('"Read a short story now": read the story, rate it, land on Your Shortlist, then tune', async ({
  page,
}) => {
  await page.clock.setFixedTime(MARCH)
  await page.goto('/')
  await page.getByRole('button', { name: 'Read a short story now' }).click()

  // Straight into the reader, with a profile saved so the welcome never returns.
  await expect(page).toHaveURL(/\/read\/pg-269-the-open-window$/)
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  expect(await readStore(page, 'profile')).toHaveLength(1)

  // Read to the end.
  for (let i = 0; i < 40; i++) {
    if ((await reader.getAttribute('data-phase')) === 'finished') break
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(150)
  }
  await expect(reader).toHaveAttribute('data-phase', 'finished')

  // The existing check-in seeds the profile.
  const end = page.getByTestId('end-screen')
  await end.getByRole('button', { name: 'Loved it' }).click()
  await expect(end.getByTestId('check-in-done')).toBeVisible()
  await end.getByRole('button', { name: 'Back to Your Shortlist' }).click()

  // Your Shortlist, with the Tune card at the top; the story just read is not on it.
  await expect(page).toHaveURL(/\/$/)
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(6)
  expect(await cards.allInnerTexts()).not.toEqual(
    expect.arrayContaining([expect.stringContaining('The Open Window')]),
  )
  const tuneCard = page.getByRole('region', { name: 'Tune your picks' })
  await expect(tuneCard).toBeVisible()

  // Open the taste cards, answer a few and update.
  await tuneCard.getByRole('link', { name: 'Tune now' }).click()
  await expect(page).toHaveURL(/\/tune$/)
  await expect(
    page.getByRole('heading', { name: 'Tune your picks' }),
  ).toBeFocused()
  const taste = page.getByRole('listitem')
  await expect(taste).toHaveCount(8)
  await taste.nth(0).getByText('Love', { exact: true }).click()
  await taste.nth(1).getByText('Maybe', { exact: true }).click()
  await page.getByRole('button', { name: 'Update my picks' }).click()

  // Back on a rebuilt shortlist; the Tune card is gone, and no second start marker was written.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(
    page.getByRole('region', { name: 'Tune your picks' }),
  ).toHaveCount(0)
  expect(await onboardReasons(page)).toEqual(
    expect.arrayContaining(['love', 'maybe']),
  )
  expect(
    (await onboardReasons(page)).filter((r) => r === 'start'),
  ).toHaveLength(0)
})

test('the Tune card can be dismissed, and stays dismissed after a reload', async ({
  page,
}) => {
  await startApp(page)
  // Pretend a story was finished.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('twice-told')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('events', 'readwrite')
          tx.objectStore('events').put({
            id: crypto.randomUUID(),
            workId: 'pg-269-the-open-window',
            type: 'finished',
            at: Date.now(),
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
  )
  await page.reload()
  const tuneCard = page.getByRole('region', { name: 'Tune your picks' })
  await expect(tuneCard).toBeVisible()
  await tuneCard
    .getByRole('button', { name: 'Dismiss Tune your picks' })
    .click()
  await expect(tuneCard).toHaveCount(0)
  // Wait for the choice to be saved before reloading.
  await expect
    .poll(async () =>
      (await readStore(page, 'settings')).some((s) => s.tuneDismissed === true),
    )
    .toBe(true)
  await page.reload()
  await expect(page.getByRole('listitem').first()).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Tune your picks' }),
  ).toHaveCount(0)
})

test('"Pick my moods first": moods, then Your Shortlist, with no taste cards', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pick my moods first' }).click()

  await expect(
    page.getByRole('heading', { name: /in the mood for/ }),
  ).toBeFocused()
  const tiles = page.getByRole('group').getByRole('button')
  await expect(tiles).toHaveCount(12)
  const next = page.getByRole('button', { name: 'Show my shortlist' })
  await expect(next).toBeDisabled()
  await expect(page.getByText(/Pick at least 2 moods/)).toBeVisible()
  await page.getByRole('button', { name: 'Eerie' }).click()
  // Keyboard: focus a tile and press Space.
  await page.getByRole('button', { name: 'Cozy' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Cozy' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(next).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Skip setup' })).toHaveCount(0)
  await next.click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(
    page.getByRole('heading', { name: /catch your eye/ }),
  ).toHaveCount(0)
  expect(await onboardReasons(page)).toEqual([
    'start',
    'mood:eerie',
    'mood:cozy',
  ])
  expect(await readStore(page, 'profile')).toHaveLength(1)

  // Coming back later does not show the welcome again.
  await page.goto('/')
  await expect(page.getByRole('listitem')).toHaveCount(6)
  await expect(page).toHaveURL(/\/$/)
})

test('Skip on the mood board goes straight to the starter mix', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pick my moods first' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
  expect(await onboardReasons(page)).toEqual(['start'])
})

test('Redo onboarding in Settings runs the full flow and keeps reading history', async ({
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
  await expect(page).toHaveURL(/\/welcome\?redo=1$/)

  // The full flow: moods, taste cards, reading context.
  await expect(
    page.getByRole('heading', { name: /in the mood for/ }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Eerie' }).click()
  await page.getByRole('button', { name: 'Cozy' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(
    page.getByRole('heading', { name: /catch your eye/ }),
  ).toBeFocused()
  await expect(page.getByRole('listitem')).toHaveCount(8)
  await page
    .getByRole('listitem')
    .first()
    .getByText('Love', { exact: true })
    .click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(
    page.getByRole('heading', { name: 'When do you usually read?' }),
  ).toBeFocused()
  await page.getByRole('checkbox', { name: 'Commute' }).check({ force: true })
  await page.getByRole('checkbox', { name: 'Evenings' }).check({ force: true })
  await page.getByRole('button', { name: 'Show me my shortlist' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)

  const after = await readStore(page, 'events')
  const ids = new Set(after.map((e) => e.id))
  for (const e of before) expect(ids.has(e.id as string)).toBe(true)
  expect(after.length).toBeGreaterThan(before.length)
})
