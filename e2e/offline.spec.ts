import { expect, test } from '@playwright/test'
import { startApp } from './helpers'

// These tests use the real service worker (the other tests keep it off).
test.use({ serviceWorkers: 'allow' })

interface CatalogEntry {
  id: string
  title: string
  textUrl: string
}

test('Your Shortlist is saved for offline, and an unsaved story shows a friendly message', async ({
  page,
  context,
  request,
}) => {
  await startApp(page)
  // Let the service worker take over the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)

  // Which books are on Your Shortlist, and which file does each one need?
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(6)
  const titles = await cards.locator('span.font-serif').allInnerTexts()
  const catalog = (await (await request.get('/catalog/catalog.json')).json())
    .entries as CatalogEntry[]
  const picks = catalog.filter((e) => titles.includes(e.title))
  expect(picks).toHaveLength(6)
  const wanted = [...new Set(picks.map((e) => e.textUrl))]

  const storedTexts = () =>
    page.evaluate(async () => {
      const keys = await (await caches.open('dog-eared-tales-texts')).keys()
      return keys.map((r) => new URL(r.url).pathname)
    })

  // While online, every pick's book is saved quietly, each file once.
  await expect.poll(storedTexts).toEqual(expect.arrayContaining(wanted))
  const stored = await storedTexts()
  expect([...new Set(stored)].sort()).toEqual([...stored].sort())

  // The cards say so.
  await expect(
    cards.first().getByRole('img', { name: 'Available offline' }),
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Available offline' }),
  ).toHaveCount(6)

  // Go offline and open a pick that was never opened or dog-eared.
  await context.setOffline(true)
  await cards.first().getByRole('button').click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Available offline')).toBeVisible()
  await sheet.getByRole('link', { name: 'Read now' }).click()
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).not.toHaveAttribute('data-locator', '')

  // A story that is not on any list was never saved: friendly message, not the error page.
  const unsaved = catalog.find((e) => !stored.includes(e.textUrl))!
  await page.goto(`/read/${unsaved.id}`)
  await expect(page.getByTestId('offline-message')).toHaveText(
    /This story isn’t saved for offline yet\. Connect once and it will be\./,
  )
  await expect(reader).toHaveAttribute('data-phase', 'offline')
  await expect(
    page.getByText('Something went wrong opening this story.'),
  ).toHaveCount(0)

  // The button takes the reader back to Your Shortlist.
  await page.getByRole('link', { name: 'Back to Your Shortlist' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('listitem')).toHaveCount(6)
})

test('a story saved while online keeps its icon in the Library and Dog-eared', async ({
  page,
}) => {
  await startApp(page)
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  const cards = page.getByRole('listitem')
  await expect(cards).toHaveCount(6)
  await cards.first().getByRole('button').click()
  await page.getByRole('button', { name: 'Dog-ear', exact: true }).click()
  await page.keyboard.press('Escape')
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Library' })
    .click()
  await page.getByRole('tab', { name: /Kept/ }).click()
  const card = page.getByRole('tabpanel').getByRole('listitem').first()
  await expect(
    card.getByRole('img', { name: 'Available offline' }),
  ).toBeVisible()
})
