import { type Page, expect, test } from '@playwright/test'

// ---------------------------------------------------------------- helpers

interface FoliateElement extends Element {
  lastLocation?: { range?: Range }
  renderer: { getContents(): { doc: Document }[] }
}

async function openStory(page: Page, id: string): Promise<void> {
  await page.goto(`/read/${id}`)
  const reader = page.getByTestId('reader')
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).not.toHaveAttribute('data-locator', '')
}

/** The text on the page the reader is looking at. */
function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const view = document.querySelector('foliate-view') as FoliateElement | null
    return (view?.lastLocation?.range?.toString() ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })
}

/** All the text of the chapter file being shown (after the engine has cut the other stories out). */
function sectionText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const view = document.querySelector('foliate-view') as FoliateElement | null
    return (view?.renderer.getContents()[0].doc.body.innerText ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })
}

async function turnForward(page: Page): Promise<void> {
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

/** Reads every record in one of the app's IndexedDB stores. */
function readStore(
  page: Page,
  store: 'progress' | 'events' | 'settings',
): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('twice-told')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains(name)) {
            db.close()
            resolve([])
            return
          }
          const all = db.transaction(name).objectStore(name).getAll()
          all.onsuccess = () => {
            db.close()
            resolve(all.result)
          }
          all.onerror = () => reject(all.error)
        }
      }),
    store,
  )
}

// ---------------------------------------------------------------- tests

test('the home page lists all 28 stories and each one opens in the reader', async ({
  page,
}) => {
  await page.goto('/')
  const links = page.getByRole('link', { name: /min$/ })
  await expect(links).toHaveCount(28)
  await page.getByRole('link', { name: /The Cask of Amontillado/ }).click()
  await expect(page).toHaveURL(/\/read\/pg-1063-the-cask-of-amontillado$/)
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
})

test('a single work keeps its position after turning 3 pages and reloading', async ({
  page,
}) => {
  await openStory(page, 'pg-1063-the-cask-of-amontillado')
  const reader = page.getByTestId('reader')

  for (let i = 0; i < 3; i++) await turnForward(page)
  const locator = await reader.getAttribute('data-locator')
  const text = await visibleText(page)
  const progress = await page
    .getByTestId('progress')
    .getAttribute('aria-valuenow')
  expect(text.length).toBeGreaterThan(50)

  // The position was saved on the page turns.
  await expect
    .poll(async () => (await readStore(page, 'progress')).map((p) => p.locator))
    .toContain(locator)

  await page.reload()
  await expect(reader).toHaveAttribute('data-phase', 'ready')
  await expect(reader).toHaveAttribute('data-locator', locator ?? '')
  await expect.poll(() => visibleText(page)).toBe(text)
  await expect(page.getByTestId('progress')).toHaveAttribute(
    'aria-valuenow',
    progress ?? '',
  )

  // And the story really was opened, then read, in the event log.
  const types = (await readStore(page, 'events')).map((e) => e.type)
  expect(types).toContain('open')
})

test('a story inside a collection starts at its own title, not the book’s title page', async ({
  page,
}) => {
  await openStory(page, 'pg-1661-a-scandal-in-bohemia')
  const text = await visibleText(page)
  expect(text.startsWith('I. A SCANDAL IN BOHEMIA')).toBe(true)

  const chapter = await sectionText(page)
  expect(chapter.toUpperCase()).not.toContain('CONTENTS')
  expect(chapter.toUpperCase()).not.toContain(
    'THE ADVENTURES OF SHERLOCK HOLMES',
  )
  expect(chapter).toContain('To Sherlock Holmes she is always the woman')

  // "Previous" on the first page of the story goes nowhere.
  const reader = page.getByTestId('reader')
  const locator = await reader.getAttribute('data-locator')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(400)
  await expect(reader).toHaveAttribute('data-locator', locator ?? '')
  await expect(
    page.getByText(/from The Adventures of Sherlock Holmes/),
  ).toBeVisible()
})

test('reaching the end of a story shows the end screen and logs it as finished', async ({
  page,
}) => {
  await openStory(page, 'pg-269-the-open-window')
  const reader = page.getByTestId('reader')
  for (let i = 0; i < 40; i++) {
    if ((await reader.getAttribute('data-phase')) === 'finished') break
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(150)
  }
  await expect(reader).toHaveAttribute('data-phase', 'finished')
  const end = page.getByTestId('end-screen')
  await expect(end).toContainText('The Open Window')
  await expect(end).toContainText('You finished it')

  await expect
    .poll(async () => (await readStore(page, 'events')).map((e) => e.type))
    .toEqual(expect.arrayContaining(['open', 'finished']))
  const saved = (await readStore(page, 'progress')).find(
    (p) => p.workId === 'pg-269-the-open-window',
  )
  expect(saved?.percent).toBe(100)

  await end.getByRole('button', { name: 'Back to Your Shortlist' }).click()
  await expect(page).toHaveURL(/\/$/)

  // Opening it again starts from the beginning.
  await openStory(page, 'pg-269-the-open-window')
  expect((await visibleText(page)).startsWith('THE OPEN WINDOW')).toBe(true)
})

test('the Aa panel changes the book at once, keeps the place, and is remembered', async ({
  page,
}) => {
  await openStory(page, 'pg-1063-the-cask-of-amontillado')
  await turnForward(page)
  await turnForward(page)
  const marker = (await visibleText(page)).slice(0, 30)

  await page.getByRole('button', { name: 'Text and theme settings' }).click()
  await page.getByRole('radio', { name: 'Night' }).check()
  await page.getByRole('radio', { name: 'Atkinson Hyperlegible' }).check()
  const larger = page.getByRole('button', { name: 'Larger text' })
  await larger.click()
  await larger.click()

  // Applied inside the book straight away.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector('foliate-view') as FoliateElement
        const win = view.renderer.getContents()[0].doc.defaultView!
        const body = win.getComputedStyle(win.document.body)
        return {
          font: body.fontFamily,
          size: body.fontSize,
          bg: body.backgroundColor,
        }
      }),
    )
    .toEqual({
      font: expect.stringContaining('Atkinson Hyperlegible'),
      size: '22px',
      bg: 'rgb(27, 28, 31)',
    })

  // The place is not lost: the page still shows the words it showed before.
  await expect.poll(() => visibleText(page)).toContain(marker)

  // Saved to the settings, and still there after a reload.
  await expect
    .poll(async () => (await readStore(page, 'settings'))[0])
    .toMatchObject({ theme: 'night', font: 'atkinson', textSize: 7 })
  await page.reload()
  await expect(page.getByTestId('reader')).toHaveAttribute(
    'data-phase',
    'ready',
  )
  await page.getByRole('button', { name: 'Text and theme settings' }).click()
  await expect(page.getByRole('radio', { name: 'Night' })).toBeChecked()
  await expect(
    page.getByRole('radio', { name: 'Atkinson Hyperlegible' }),
  ).toBeChecked()
  await expect(page.getByText('Text size: 7 of 10')).toBeVisible()
})

test('tapping the left and right of the page turns it, and the progress bar follows', async ({
  page,
}) => {
  await openStory(page, 'pg-1063-the-cask-of-amontillado')
  const reader = page.getByTestId('reader')
  const bar = page.getByTestId('progress')
  const before = Number(await bar.getAttribute('aria-valuenow'))

  /** Taps a zone until the page changes (a tap during a page turn is ignored). */
  const tap = async (name: 'Next page' | 'Previous page'): Promise<string> => {
    const was = (await reader.getAttribute('data-locator')) ?? ''
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.getByRole('button', { name }).click()
      await page.waitForTimeout(250)
      const now = (await reader.getAttribute('data-locator')) ?? ''
      if (now !== was) return now
    }
    throw new Error(`tapping "${name}" did not turn the page`)
  }

  await tap('Next page')
  await tap('Next page')
  const third = await tap('Next page')
  await expect
    .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
  await expect(page.getByTestId('minutes-left')).toContainText(
    'min left in this story',
  )

  await tap('Next page')
  expect(await tap('Previous page')).toBe(third)
})
