import { test, expect } from '@playwright/test'

test('a first visit shows the name, headline and subline', async ({ page }) => {
  // Out of season, so the default words show whatever the real date is.
  await page.clock.setFixedTime(new Date(2026, 2, 3, 12))
  await page.goto('/')
  await expect(page).toHaveTitle('Dog-Eared Tales')
  await expect(page.getByText('Dog-Eared Tales', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Free classics, picked for you.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Start short. Fold down a corner when one gets you.'),
  ).toBeVisible()
})
