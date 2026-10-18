import { type Page, devices, expect, test } from '@playwright/test'
import { mapProfileDb, readStore } from './helpers'

// A Pixel-sized touch phone (412 x 915).
test.use({ ...devices['Pixel 7'] })

const STORY = 'pg-1063-the-cask-of-amontillado'

test.beforeEach(async ({ page }) => {
  await mapProfileDb(page)
})

/** A real touch swipe, sent through the browser's touch input. */
async function swipe(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  const point = (x: number, y: number) => [{ x, y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(...from),
  })
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(
        from[0] + ((to[0] - from[0]) * i) / steps,
        from[1] + ((to[1] - from[1]) * i) / steps,
      ),
    })
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await cdp.detach()
}

function savedLocators(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('profile-db')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const all = db
            .transaction('progress')
            .objectStore('progress')
            .getAll()
          all.onsuccess = () => {
            db.close()
            resolve(
              (all.result as { locator: unknown }[]).map((p) => p.locator),
            )
          }
        }
      }),
  )
}

async function openStory(page: Page): Promise<void> {
  await page.goto(`/read/${STORY}`)
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).not.toHaveAttribute('data-locator', '')
  // Out of the way of the swipes.
  await page.getByRole('button', { name: 'Got it' }).click()
}

test('swiping left turns to the next page and right turns back, and the position is saved', async ({
  page,
}) => {
  await openStory(page)
  const reader = page.getByTestId('reader')
  const first = (await reader.getAttribute('data-locator')) ?? ''

  await swipe(page, [320, 400], [100, 405])
  await expect(reader).not.toHaveAttribute('data-locator', first)
  const second = (await reader.getAttribute('data-locator')) ?? ''
  await expect.poll(() => savedLocators(page)).toContain(second)

  await swipe(page, [100, 400], [320, 395])
  await expect(reader).toHaveAttribute('data-locator', first)
})

test('a vertical swipe, or one that starts at the screen edge, does not turn the page', async ({
  page,
}) => {
  await openStory(page)
  const reader = page.getByTestId('reader')
  const first = (await reader.getAttribute('data-locator')) ?? ''

  await swipe(page, [200, 700], [215, 300])
  await swipe(page, [10, 400], [300, 400])
  await swipe(page, [405, 400], [100, 400])
  await expect(reader).toHaveAttribute('data-locator', first)

  // A swipe that does count still works afterwards.
  await swipe(page, [320, 400], [100, 400])
  await expect(reader).not.toHaveAttribute('data-locator', first)
})

test('the first-time hint shows once, and not again after it is dismissed', async ({
  page,
}) => {
  await page.goto(`/read/${STORY}`)
  const hint = page.getByTestId('reader-hint')
  await expect(hint).toContainText('Tap the edges or swipe to turn pages.')
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(hint).toHaveCount(0)
  // The choice is saved a moment after the note goes away; reload only once it is.
  await expect
    .poll(async () =>
      (await readStore(page, 'settings')).some(
        (s) => s.readerHintSeen === true,
      ),
    )
    .toBe(true)

  await page.reload()
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  await expect(hint).toHaveCount(0)

  // Another story does not show it either.
  await page.goto('/read/pg-1064-the-masque-of-the-red-death')
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  await expect(hint).toHaveCount(0)
})
