import { type Page, expect } from '@playwright/test'

/** Turns one page forward in the reader and waits until the position changes. */
export async function turnForward(page: Page): Promise<void> {
  const reader = page.getByTestId('reader')
  const before = (await reader.getAttribute('data-locator')) ?? ''
  // A key pressed while the previous page is still settling is ignored, so press again if needed.
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(250)
    if ((await reader.getAttribute('data-locator')) !== before) return
  }
  throw new Error('the page did not turn')
}

/** Waits for the reader to be ready on its first page. */
export async function waitForReader(page: Page): Promise<void> {
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).not.toHaveAttribute('data-locator', '')
}
