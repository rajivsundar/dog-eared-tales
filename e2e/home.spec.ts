import { test, expect } from '@playwright/test'

test('home page shows the name and tagline', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Twice Told')
  await expect(page.getByRole('heading', { name: 'Twice Told' })).toBeVisible()
  await expect(
    page.getByText(
      'Great free stories, picked for you. Start short. Fall for the classics.',
    ),
  ).toBeVisible()
})
