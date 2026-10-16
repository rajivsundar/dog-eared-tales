import { expect, test } from '@playwright/test'
import { shippedCount, startApp } from './helpers'

const sizes = [
  { name: 'phone (360 px wide)', width: 360, height: 740, columns: 1 },
  { name: 'desktop', width: 1280, height: 800, columns: 3 },
]

for (const size of sizes) {
  test(`Your Shortlist fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await startApp(page)
    const cards = page.getByRole('listitem')
    await expect(cards).toHaveCount(6)

    // No sideways scrolling.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // Cards sit in 1 column on a phone and 3 on a wide screen.
    const lefts = await cards.evaluateAll((items) =>
      items.map((el) => Math.round(el.getBoundingClientRect().left)),
    )
    expect(new Set(lefts).size).toBe(size.columns)

    // The detail sheet opens inside the screen and shows content notes and the source link.
    await cards.first().getByRole('button').click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId('content-notes')).toBeVisible()
    await expect(
      sheet.getByRole('link', { name: 'View on Project Gutenberg' }),
    ).toHaveAttribute('href', /gutenberg\.org/)
    const box = (await sheet.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(size.width)
    expect(box.y + box.height).toBeLessThanOrEqual(size.height)
    await expect(sheet.getByRole('link', { name: 'Read now' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Dog-ear' })).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: 'Not for me' }),
    ).toBeVisible()
  })
}

test('the same picks come back after a reload', async ({ page }) => {
  await startApp(page)
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(6)
  const before = await cards.allInnerTexts()
  await page.reload()
  await expect(cards).toHaveCount(6)
  expect(await cards.allInnerTexts()).toEqual(before)
})

test('Not for me swaps the card and Undo brings it back', async ({ page }) => {
  await startApp(page)
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(6)
  const before = await cards.allInnerTexts()
  await cards.first().getByRole('button').click()
  await page.getByRole('button', { name: 'Not for me' }).click()
  await expect(page.getByRole('status')).toContainText('Removed')
  await expect(cards).toHaveCount(6)
  expect(await cards.allInnerTexts()).not.toEqual(before)
  await page.getByRole('button', { name: 'Undo' }).click()
  expect(await cards.allInnerTexts()).toEqual(before)
})

test('the full list stays at /all', async ({ page, request }) => {
  await page.goto('/all')
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(
    await shippedCount(request),
  )
})
