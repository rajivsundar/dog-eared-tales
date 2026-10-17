import { expect, test } from '@playwright/test'
import { startApp } from './helpers'

test('The Art of War, chapter I, shows its ancient date and translator on the detail sheet', async ({
  page,
}) => {
  // Keep the catalog small so this chapter is certain to be on Your Shortlist.
  await page.route('**/catalog/catalog.json', async (route) => {
    const response = await route.fetch()
    const file = (await response.json()) as { entries: { id: string }[] }
    const wanted = 'pg-132-chapter-i-laying-plans'
    const others = file.entries.filter((e) => e.id !== wanted).slice(0, 5)
    const entry = file.entries.find((e) => e.id === wanted)!
    await route.fulfill({
      response,
      json: { ...file, entries: [entry, ...others] },
    })
  })
  await startApp(page)
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Laying Plans' })
    .getByRole('button')
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText(
    'c. 500 BCE · Translated by Lionel Giles, 1910',
  )
})
