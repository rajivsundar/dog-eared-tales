import { test, expect } from '@playwright/test'

test('a first visit shows the name, headline and subline', async ({ page }) => {
  // Out of season, so the default words show whatever the real date is.
  await page.clock.setFixedTime(new Date(2026, 2, 3, 12))
  await page.goto('/')
  await expect(page).toHaveTitle('Twice Told')
  await expect(page.getByText('Twice Told', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Great free stories, picked for you.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Start short. Fall for the classics.'),
  ).toBeVisible()
})
