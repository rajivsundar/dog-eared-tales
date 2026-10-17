import { expect, test } from '@playwright/test'
import { mapProfileDb, startApp } from './helpers'

test.beforeEach(async ({ page }) => {
  await mapProfileDb(page)
})

const FALL = new Date(2026, 9, 16, 11, 0)

test('fall: the artwork, the subtitle and Tales for Longer Nights on the real catalog', async ({
  page,
}) => {
  await page.clock.setFixedTime(FALL)
  await startApp(page, 'keep')
  await expect(page.getByText('Fresh picks for longer nights')).toBeVisible()
  const row = page.getByRole('region', { name: 'Tales for Longer Nights' })
  await expect(row).toBeVisible()
  // Usher is first, with its reason; every card is eerie fiction, with content notes.
  const first = row.getByRole('listitem').first()
  await expect(first).toContainText('The Fall of the House of Usher')
  await expect(first).toContainText("This fall's best-named story")
  await expect(row.getByText(/Content notes:/).first()).toBeVisible()
  expect(await row.getByRole('listitem').count()).toBeLessThanOrEqual(6)
  await expect(row).not.toContainText('A Modest Proposal')
  // The leaf on the heading.
  await expect(
    page.getByRole('heading', { name: 'Your Shortlist' }).locator('svg'),
  ).toBeVisible()
})

test('out of season, or with the toggle off, nothing seasonal shows', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 11, 1, 11, 0))
  await startApp(page, 'keep')
  await expect(page.getByRole('region', { name: /Longer Nights/ })).toHaveCount(
    0,
  )
  await expect(
    page.getByText(/Great free stories, picked for you/),
  ).toBeVisible()

  // In fall, switching the toggle off removes it all.
  const fall = await page.context().newPage()
  await mapProfileDb(fall)
  await fall.clock.setFixedTime(FALL)
  await fall.goto('/')
  await expect(
    fall.getByRole('region', { name: 'Tales for Longer Nights' }),
  ).toBeVisible()
  await fall
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click()
  await fall.getByRole('switch', { name: /Seasonal themes/ }).uncheck()
  await fall
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Shortlist' })
    .click()
  await expect(
    fall.getByText(/Great free stories, picked for you/),
  ).toBeVisible()
  await expect(fall.getByRole('region', { name: /Longer Nights/ })).toHaveCount(
    0,
  )
})

test('the welcome preview shows the artwork and changes nothing', async ({
  page,
}) => {
  await page.clock.setFixedTime(FALL)
  await startApp(page, 'keep')
  const dbs = () =>
    page.evaluate(async () => {
      const out: Record<string, unknown> = {}
      for (const d of await indexedDB.databases()) {
        if (!d.name?.startsWith('twice-told-p-')) continue
        out[d.name] = await new Promise((resolve) => {
          const open = indexedDB.open(d.name!)
          open.onsuccess = () => {
            const db = open.result
            const stores = [...db.objectStoreNames]
            const tx = db.transaction(stores)
            const result: Record<string, unknown> = {}
            let left = stores.length
            for (const s of stores) {
              const all = tx.objectStore(s).getAll()
              all.onsuccess = () => {
                // The daily shortlist, kept in the settings, is not what the preview could change.
                result[s] = all.result
                if (--left === 0) {
                  db.close()
                  resolve(result)
                }
              }
            }
          }
        })
      }
      return JSON.stringify(out)
    })
  const before = await dbs()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click()
  await page.getByRole('link', { name: 'See the welcome screen' }).click()
  await expect(page).toHaveURL(/\/welcome\?preview=1/)
  await expect(page.getByTestId('season-scene')).toBeVisible()
  await expect(page.getByTestId('season-leaves')).toBeVisible()
  await expect(page.getByText('Preview of the welcome screen')).toBeVisible()
  await page.getByRole('link', { name: 'Back to Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  expect(await dbs()).toBe(before)
})

test('reduced motion stops the leaves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(FALL)
  await page.goto('/welcome')
  const leaf = page.locator('.tt-leaf').first()
  await expect(leaf).toBeVisible()
  expect(await leaf.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  )
  await expect(page.getByTestId('season-leaves')).toHaveAttribute(
    'data-motion',
    'static',
  )
})

test('the Aa button sits next to the dog-ear button at every width', async ({
  page,
}) => {
  for (const width of [320, 360, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    // The longest title in the catalog is the hard case for the top bar.
    await page.goto('/read/pg-932-the-fall-of-the-house-of-usher')
    await expect(page.getByTestId('reader')).toHaveAttribute(
      'data-phase',
      'ready',
    )
    const aa = page.getByRole('button', { name: 'Text and theme settings' })
    const dog = page.getByRole('button', { name: /Dog-ear/ })
    await expect(aa).toBeVisible()
    await expect(dog).toBeVisible()
    const a = (await aa.boundingBox())!
    const d = (await dog.boundingBox())!
    expect(
      a.x + a.width,
      `Aa inside the screen at ${width}`,
    ).toBeLessThanOrEqual(width)
    expect(d.x, `dog-ear inside the screen at ${width}`).toBeGreaterThanOrEqual(
      0,
    )
    expect(a.x).toBeGreaterThan(d.x) // Aa is next to it, on its right
    expect(Math.abs(a.y - d.y)).toBeLessThan(30)
    expect(a.x - (d.x + d.width)).toBeLessThan(24)
  }
})

for (const [width, height, label] of [
  [360, 780, '360 px'],
  [1280, 800, 'desktop'],
] as const) {
  test(`the falling leaves never cross text or buttons (${label})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.clock.setFixedTime(FALL)
    await page.goto('/welcome')
    await expect(page.getByTestId('season-leaves')).toBeVisible()
    const container = page.getByTestId('season-leaves')
    // The container is behind content and never takes a click.
    expect(
      await container.evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe('none')
    // Instead of waiting for the animation, move it to many points in its cycle (the Web Animations
    // API) and look at where the leaves are at each one.
    const hits = await page.evaluate(() => {
      const rect = (el: Element) => el.getBoundingClientRect()
      const animations = document.getAnimations()
      for (const a of animations) a.pause()
      const out: string[] = []
      for (let ms = 0; ms <= 20000; ms += 250) {
        for (const a of animations) a.currentTime = ms
        // What can be seen of each leaf: the container clips whatever is outside it.
        const box = rect(
          document.querySelector('[data-testid="season-leaves"]')!,
        )
        const leaves = [...document.querySelectorAll('.tt-leaf')]
          .map(rect)
          .map((r) => ({
            left: Math.max(r.left, box.left),
            right: Math.min(r.right, box.right),
            top: Math.max(r.top, box.top),
            bottom: Math.min(r.bottom, box.bottom),
          }))
          .filter((r) => r.right > r.left && r.bottom > r.top)
        const text = [
          ...document.querySelectorAll('main h1, main p, main button, main a'),
        ]
          .filter((el) => !el.closest('[data-testid="season-leaves"]'))
          .map((el) => ({ name: el.textContent?.slice(0, 30), box: rect(el) }))
        for (const leaf of leaves) {
          for (const t of text) {
            const overlap =
              leaf.left < t.box.right &&
              leaf.right > t.box.left &&
              leaf.top < t.box.bottom &&
              leaf.bottom > t.box.top
            if (overlap && t.box.width > 0) out.push(`${t.name} at ${ms} ms`)
          }
        }
      }
      return { out, animated: animations.length }
    })
    expect(hits.animated).toBeGreaterThanOrEqual(5) // the leaves really are animated
    expect(hits.out).toEqual([])
    // At 360 px the leaves are all above the wordmark.
    if (width === 360) {
      const wordmark = (await page
        .getByText('Twice Told', { exact: true })
        .first()
        .boundingBox())!
      const box = (await container.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(wordmark.y + 1)
    }
  })
}
