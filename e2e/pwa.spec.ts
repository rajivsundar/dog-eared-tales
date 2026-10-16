import { expect, test } from '@playwright/test'
import { startApp } from './helpers'

// These tests use the real service worker (the other tests keep it off).
test.use({ serviceWorkers: 'allow' })

const STORY = 'pg-1063-the-cask-of-amontillado'

test('the web app manifest describes the app', async ({ page, request }) => {
  await page.goto('/welcome')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'Twice Told',
    short_name: 'Twice Told',
    description:
      'Great free stories, picked for you. Start short. Fall for the classics.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#1b1c1f',
    background_color: '#fbf8f2',
  })
  const icons = manifest.icons as {
    sizes: string
    purpose?: string
    src: string
  }[]
  expect(icons.map((i) => [i.sizes, i.purpose ?? 'any'])).toEqual([
    ['192x192', 'any'],
    ['512x512', 'any'],
    ['512x512', 'maskable'],
  ])
  for (const icon of icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true)
  }
})

test('works offline: the shell, library and a story that was opened before', async ({
  page,
  context,
  request,
}) => {
  await startApp(page)
  // Wait for the service worker to take over (it claims the page after the first load).
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)

  // The shell, fonts, catalog and covers are precached; no book text is.
  const precache = await page.evaluate(async () => {
    const names = await caches.keys()
    const name = names.find((n) => n.includes('precache'))!
    const keys = await (await caches.open(name)).keys()
    return keys.map((r) => new URL(r.url).pathname)
  })
  expect(precache).toContain('/catalog/catalog.json')
  expect(precache.some((p) => p.startsWith('/covers/'))).toBe(true)
  expect(precache.some((p) => p.endsWith('.woff2'))).toBe(true)
  expect(precache.some((p) => p.startsWith('/texts/'))).toBe(false)

  // Opening a story puts its text in its own cache (it may already be there: Your Shortlist is saved ahead).
  await page.goto(`/read/${STORY}`)
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  const texts = await page.evaluate(async () => {
    const keys = await (await caches.open('twice-told-texts')).keys()
    return keys.map((r) => new URL(r.url).pathname)
  })
  expect(texts).toContain('/texts/pg-1063.epub')
  // Not every book: only the ones needed so far.
  expect(texts.length).toBeLessThan(10)

  // Offline: a reload of /read/:id, and /library, still work.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  await expect(page.getByTestId('reader')).not.toHaveAttribute(
    'data-locator',
    '',
  )
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('listitem').first()).toBeVisible()

  // A story that was never saved is not there offline: a friendly message, not an error.
  const catalog = (await (await request.get('/catalog/catalog.json')).json())
    .entries as { id: string; textUrl: string }[]
  const unsaved = catalog.find((e) => !texts.includes(e.textUrl))!
  await page.goto(`/read/${unsaved.id}`)
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'offline',
  )
})
