import { expect, test } from '@playwright/test'
import { turnForward, waitForReader } from './helpers'

test('a dog-eared story moves to Reading after two pages, with minutes left', async ({
  page,
}) => {
  // Dog-ear the first story on Your Shortlist.
  await page.goto('/')
  const card = page.getByRole('listitem').first()
  const title = (await card.getByRole('heading').count())
    ? ''
    : (await card.locator('span.font-serif').innerText()).trim()
  await card.getByRole('button').click()
  await page.getByRole('button', { name: 'Dog-ear', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dog-eared' })).toBeEnabled()
  await page.keyboard.press('Escape')

  // It is under Dog-eared in the Library, not under Reading.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Library' })
    .click()
  await expect(page).toHaveURL(/\/library/)
  await expect(page.getByText(/Nothing in progress yet/)).toBeVisible()
  await page.getByRole('tab', { name: /Dog-eared/ }).click()
  const entry = page.getByRole('link', { name: new RegExp(title) })
  await expect(entry).toBeVisible()

  // Open it. Just opening does not move it.
  await entry.click()
  await waitForReader(page)
  await page.goBack()
  await page.getByRole('tab', { name: /Dog-eared/ }).click()
  await expect(
    page.getByRole('link', { name: new RegExp(title) }),
  ).toBeVisible()

  // Open it again and read two pages.
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await waitForReader(page)
  await turnForward(page)
  await turnForward(page)
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open('twice-told')
            open.onsuccess = () => {
              const all = open.result
                .transaction('progress')
                .objectStore('progress')
                .getAll()
              all.onsuccess = () => {
                open.result.close()
                resolve(all.result.length)
              }
            }
          }),
      ),
    )
    .toBe(1)

  // Back in the Library it has moved to Reading, with minutes left.
  await page.goBack()
  await page.getByRole('tab', { name: /Dog-eared/ }).click()
  await expect(page.getByText(/Nothing dog-eared yet/)).toBeVisible()
  await page.getByRole('tab', { name: /Reading/ }).click()
  const reading = page.getByRole('link', { name: new RegExp(title) })
  await expect(reading).toBeVisible()
  await expect(reading).toContainText(/\d+ min left/)
  await expect(reading.getByRole('progressbar')).toBeVisible()
})

test('the bottom navigation is on every screen except the reader, with big tap targets', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const [path, current] of [
    ['/', 'Shortlist'],
    ['/library', 'Library'],
    ['/settings', 'Settings'],
  ] as const) {
    await page.goto(path)
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: current })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const link of await nav.getByRole('link').all()) {
      const box = (await link.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.goto('/library')
  for (const tab of await page.getByRole('tab').all()) {
    expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }

  await page.goto('/read/pg-1063-the-cask-of-amontillado')
  await waitForReader(page)
  await expect(nav).toHaveCount(0)
})

test('the Removed · Undo message sits above the bottom navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await page.getByRole('listitem').first().getByRole('button').click()
  await page.getByRole('button', { name: 'Not for me' }).click()
  const toast = page.getByRole('status')
  await expect(toast).toBeVisible()
  const toastBox = (await toast.boundingBox())!
  const navBox = (await page
    .getByRole('navigation', { name: 'Main' })
    .boundingBox())!
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y)
  expect(
    (await toast.getByRole('button').boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44)
})

test('un-dog-ear shows Removed · Undo, and Undo brings the story back', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('listitem').first().getByRole('button').click()
  await page.getByRole('button', { name: 'Dog-ear', exact: true }).click()
  await page.keyboard.press('Escape')
  // Use the navigation (no page reload) so the dog-ear is certainly saved first.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Library' })
    .click()
  await page.getByRole('tab', { name: /Dog-eared/ }).click()
  await expect(page.getByRole('tabpanel').getByRole('listitem')).toHaveCount(1)
  await page.getByRole('button', { name: /^Un-dog-ear/ }).click()
  await expect(page.getByRole('status')).toContainText('Removed')
  await expect(page.getByText(/Nothing dog-eared yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('tabpanel').getByRole('listitem')).toHaveCount(1)
})

test('the reader has a dog-ear button that does not move the reading position', async ({
  page,
}) => {
  await page.goto('/read/pg-1063-the-cask-of-amontillado')
  await waitForReader(page)
  await turnForward(page)
  const reader = page.getByTestId('reader')
  const place = await reader.getAttribute('data-locator')

  await page.getByRole('button', { name: 'Dog-ear it for later' }).click()
  const filled = page.getByRole('button', { name: 'Dog-eared' })
  await expect(filled).toHaveAttribute('title', 'Dog-eared')
  await expect(page.getByTestId('dog-ear-icon')).toHaveAttribute(
    'data-filled',
    'true',
  )
  await filled.click()
  await expect(page.getByRole('status')).toContainText('Removed')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Dog-eared' })).toBeVisible()
  await page.waitForTimeout(400)
  await expect(reader).toHaveAttribute('data-locator', place ?? '')
})
