// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  type FoliateBook,
  type FoliateRenderer,
  type FoliateTarget,
  type FoliateView,
  FoliateReaderEngine,
} from './FoliateReaderEngine'
import { THEME_COLORS } from './readerStyle'
import type { LocationInfo } from './types'

// ---------------------------------------------------------------- a pretend foliate-js
// It shows each chapter file as 3 pages and tells the engine where the reader is,
// the same way foliate-js does. It also records every page turn the engine asks for.

const PAGES = 3
const WORD = /[A-Za-z0-9]+/g

function parse(html: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${html}</body></html>`,
    'text/html',
  )
}

/** A Range that starts at the nth word of the page. */
function rangeAtWord(doc: Document, n: number): Range {
  const range = doc.createRange()
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let count = 0
  let last: Text | null = null
  for (
    let node = walker.nextNode() as Text | null;
    node;
    node = walker.nextNode() as Text | null
  ) {
    last = node
    for (const m of node.data.matchAll(WORD)) {
      if (count === n) {
        range.setStart(node, m.index)
        range.collapse(true)
        return range
      }
      count++
    }
  }
  range.selectNodeContents(last ?? doc.body)
  range.collapse(false)
  return range
}

class FakeRenderer extends EventTarget implements FoliateRenderer {
  css: string[] = []
  constructor(private view: FakeView) {
    super()
  }
  setStyles(css: string): void {
    this.css.push(css)
  }
  async goTo(target: FoliateTarget): Promise<void> {
    const lastPage =
      typeof target.anchor === 'function' &&
      target.anchor(document) === (1 as unknown)
    await this.view.show(target.index, lastPage ? PAGES - 1 : 0)
  }
}

class FakeView extends EventTarget implements FoliateView {
  book: FoliateBook
  renderer = new FakeRenderer(this)
  nextCalls = 0
  prevCalls = 0
  loaded: number[] = []
  index = -1
  page = 0
  doc: Document | null = null
  closed = false

  constructor(private sections: string[]) {
    super()
    this.book = {
      sections: sections.map((html) => ({
        createDocument: async () => parse(html),
      })),
      resolveHref: (href) => {
        const [file, id] = href.split('#')
        const index = Number(/s(\d+)/.exec(file)?.[1])
        if (!sections[index]) return null
        return {
          index,
          anchor: id ? (doc: Document) => doc.getElementById(id) : undefined,
        }
      },
    }
  }

  async open(): Promise<void> {}
  close(): void {
    this.closed = true
  }
  getCFI(index: number): string {
    return `cfi:${index}:${this.page}`
  }
  resolveNavigation(target: string): FoliateTarget | null {
    const cfi = /^cfi:(\d+):(\d+)$/.exec(target)
    if (cfi) return { index: Number(cfi[1]) }
    return this.book.resolveHref(target) ?? null
  }

  async goTo(target: string | number): Promise<void> {
    if (typeof target === 'number') return this.show(target, 0)
    const cfi = /^cfi:(\d+):(\d+)$/.exec(target)
    if (cfi) return this.show(Number(cfi[1]), Number(cfi[2]))
    const resolved = this.book.resolveHref(target)
    if (resolved) return this.show(resolved.index, 0)
  }
  async goToTextStart(): Promise<void> {
    return this.show(0, 0)
  }
  async next(): Promise<void> {
    this.nextCalls++
    if (this.page + 1 < PAGES) return this.show(this.index, this.page + 1)
    if (this.index + 1 < this.sections.length)
      return this.show(this.index + 1, 0)
  }
  async prev(): Promise<void> {
    this.prevCalls++
    if (this.page > 0) return this.show(this.index, this.page - 1)
    if (this.index > 0) return this.show(this.index - 1, PAGES - 1)
  }

  async show(index: number, page: number): Promise<void> {
    if (index !== this.index) {
      this.doc = await this.book.sections[index].createDocument!()
      this.loaded.push(index)
      this.dispatchEvent(
        new CustomEvent('load', { detail: { doc: this.doc, index } }),
      )
    }
    this.index = index
    this.page = page
    const doc = this.doc!
    const words = (doc.body.textContent.match(WORD) ?? []).length
    const range = rangeAtWord(doc, Math.floor((page * words) / PAGES))
    this.renderer.dispatchEvent(
      new CustomEvent('relocate', {
        detail: { index, range, fraction: page / PAGES, size: 1 / PAGES },
      }),
    )
  }
}

// ---------------------------------------------------------------- a pretend book
// Chapter file 0 is a cover. Story A is wholly inside file 1. Story B starts in file 1 and
// ends in file 2. File 3 holds other stories.
const WORDS = (n: number, tag: string): string =>
  Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ')

const BOOK = [
  `<p id="cover">cover words that are not any story</p>`,
  `<h2 id="a">Story A</h2>
<p>${WORDS(60, 'a')}</p>
<h2 id="b">Story B</h2>
<p>${WORDS(30, 'b')}</p>`,
  `<p>${WORDS(30, 'c')}</p><h2 id="c">Story C</h2><p>${WORDS(30, 'x')}</p>`,
  `<h2 id="d">Story D</h2>
<p>${WORDS(20, 'tail')}</p>`,
]

interface Setup {
  engine: FoliateReaderEngine
  view: FakeView
  locations: LocationInfo[]
  ends: number
  container: HTMLElement
}

function setup(): Setup {
  const view = new FakeView(BOOK)
  const container = document.createElement('div')
  const engine = new FoliateReaderEngine({
    container,
    createView: async () => view,
    prefersDark: () => false,
    fontFaceCss: () => '/* fonts */',
  })
  const s: Setup = { engine, view, locations: [], ends: 0, container }
  engine.onLocation((l) => s.locations.push(l))
  engine.onRangeEnd(() => s.ends++)
  return s
}

const STORY_A = { startHref: 's1.xhtml#a', endHref: 's1.xhtml#b' }
const STORY_B = { startHref: 's1.xhtml#b', endHref: 's2.xhtml#c' }

const squash = (doc: Document): string =>
  doc.body.textContent.replace(/\s+/g, ' ')

describe('a story inside one chapter file', () => {
  let t: Setup
  beforeEach(async () => {
    t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_A)
  })

  it('opens on the first page of the story, showing only the story', () => {
    const shown = squash(t.view.doc!)
    expect(shown).toContain('Story A')
    expect(shown).toContain('a59')
    expect(shown).not.toContain('Story B')
    expect(shown).not.toContain('b0')
    expect(t.locations.at(-1)).toMatchObject({
      atStart: true,
      atEnd: false,
      fraction: 0,
    })
    expect(t.view.index).toBe(1)
  })

  it('measures minutes left from the story only, at 238 words per minute', () => {
    // "Story A" plus 60 words is 62 words. The rest of the book is not counted.
    expect(t.locations.at(-1)?.wordsLeft).toBe(62)
    expect(t.locations.at(-1)?.minutesLeft).toBe(1)
  })

  it('never pages back before the start', async () => {
    await t.engine.prev()
    expect(t.view.prevCalls).toBe(0)
    expect(t.view.index).toBe(1)
    expect(t.view.page).toBe(0)
  })

  it('fires onRangeEnd on the last page instead of turning it, and loads nothing beyond', async () => {
    await t.engine.next()
    await t.engine.next()
    expect(t.locations.at(-1)).toMatchObject({ atEnd: true })
    expect(t.ends).toBe(0)
    await t.engine.next()
    expect(t.ends).toBe(1)
    expect(t.view.nextCalls).toBe(2)
    expect(t.view.loaded).toEqual([1])
    await t.engine.next()
    expect(t.ends).toBe(2)
    expect(t.view.nextCalls).toBe(2)
  })

  it('reports progress rising from 0 to nearly 1 across the pages', async () => {
    await t.engine.next()
    const middle = t.locations.at(-1)!
    await t.engine.next()
    const last = t.locations.at(-1)!
    expect(middle.fraction).toBeGreaterThan(0)
    expect(last.fraction).toBeGreaterThan(middle.fraction)
    expect(last.fraction).toBeLessThan(1)
    expect(last.minutesLeft).toBe(1)
  })
})

describe('a story that runs across two chapter files', () => {
  let t: Setup
  beforeEach(async () => {
    t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_B)
  })

  it('opens at the start marker and hides the story before it', () => {
    const shown = squash(t.view.doc!)
    expect(shown).toContain('Story B')
    expect(shown).not.toContain('Story A')
    expect(shown).not.toContain('a0')
    expect(t.view.index).toBe(1)
    expect(t.locations.at(-1)?.atStart).toBe(true)
  })

  it('counts words in both chapter files and nothing outside them', () => {
    // "Story B" + 30 words in file 1, then 30 words in file 2 before the next story.
    expect(t.locations.at(-1)?.wordsLeft).toBe(32 + 30)
  })

  it('pages across the file boundary and ends on the last page of the second file', async () => {
    for (let i = 0; i < 3; i++) await t.engine.next() // through file 1 into file 2
    expect(t.view.index).toBe(2)
    expect(squash(t.view.doc!)).toContain('c29')
    expect(squash(t.view.doc!)).not.toContain('Story C')
    expect(squash(t.view.doc!)).not.toContain('x0')

    await t.engine.next()
    await t.engine.next()
    expect(t.locations.at(-1)).toMatchObject({ atEnd: true })
    expect(t.ends).toBe(0)
    await t.engine.next()
    expect(t.ends).toBe(1)
    expect(t.view.loaded).toEqual([1, 2])
    expect(t.view.loaded).not.toContain(3)
  })

  it('goes back across the boundary but never before the start', async () => {
    for (let i = 0; i < 3; i++) await t.engine.next()
    expect(t.view.index).toBe(2)
    await t.engine.prev()
    expect(t.view.index).toBe(1)
    await t.engine.prev()
    await t.engine.prev()
    expect(t.view.page).toBe(0)
    const turns = t.view.prevCalls
    await t.engine.prev()
    expect(t.view.prevCalls).toBe(turns)
    expect(t.view.loaded).not.toContain(0)
  })

  it('measures progress across both files together', async () => {
    for (let i = 0; i < 3; i++) await t.engine.next()
    const atSecondFile = t.locations.at(-1)!
    // Reached the start of file 2, so file 1's 32 words are read: 32 of 62.
    expect(atSecondFile.fraction).toBeCloseTo(32 / 62, 1)
  })
})

describe('a story whose end marker is at the very top of the next chapter file', () => {
  it('stops at the end of the last chapter file that holds the story and never opens the next one', async () => {
    const view = new FakeView(BOOK)
    const engine = new FoliateReaderEngine({
      container: document.createElement('div'),
      createView: async () => view,
      prefersDark: () => false,
      fontFaceCss: () => '',
    })
    let ends = 0
    engine.onRangeEnd(() => ends++)
    await engine.open('/texts/pg-1.epub', {
      startHref: 's2.xhtml#c',
      endHref: 's3.xhtml#d',
    })
    for (let i = 0; i < PAGES - 1; i++) await engine.next()
    await engine.next()
    expect(ends).toBe(1)
    expect(view.index).toBe(2)
    expect(view.loaded).toEqual([2])
  })
})

describe('jumping to a saved place', () => {
  it('resumes at a saved place inside the story', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', { ...STORY_B, locator: 'cfi:2:1' })
    expect(t.view.index).toBe(2)
    expect(t.view.page).toBe(1)
  })

  it('moves a place before the story to the start', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_B)
    await t.engine.next()
    await t.engine.goTo('cfi:0:0')
    expect(t.view.index).toBe(1)
    expect(t.locations.at(-1)?.atStart).toBe(true)
    expect(t.view.loaded).not.toContain(0)
  })

  it('moves a place after the story to its last page', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_B)
    await t.engine.goTo('cfi:3:0')
    expect(t.view.index).toBe(2)
    expect(t.locations.at(-1)?.atEnd).toBe(true)
    expect(t.view.loaded).not.toContain(3)
  })

  it('starts at the beginning when the saved place is unusable', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', { ...STORY_A, locator: 'nonsense' })
    expect(t.view.index).toBe(1)
    expect(t.locations.at(-1)?.atStart).toBe(true)
  })
})

describe('opening problems', () => {
  it('stops with a clear message when a marker is not in the book', async () => {
    const t = setup()
    await expect(
      t.engine.open('/x.epub', {
        startHref: 's9.xhtml#a',
        endHref: 's1.xhtml#b',
      }),
    ).rejects.toThrow(/startHref not found/)
    await expect(
      t.engine.open('/x.epub', {
        startHref: 's1.xhtml#a',
        endHref: 's9.xhtml#b',
      }),
    ).rejects.toThrow(/endHref not found/)
  })

  it('stops when only one marker is given, or the story ends before it starts', async () => {
    const t = setup()
    await expect(
      t.engine.open('/x.epub', { startHref: 's1.xhtml#a' }),
    ).rejects.toThrow(/together/)
    await expect(
      t.engine.open('/x.epub', {
        startHref: 's2.xhtml#c',
        endHref: 's1.xhtml#a',
      }),
    ).rejects.toThrow(/ends before/)
  })

  it('stops when a marker is missing from its chapter file', async () => {
    const t = setup()
    await expect(
      t.engine.open('/x.epub', {
        startHref: 's1.xhtml#nope',
        endHref: 's2.xhtml#c',
      }),
    ).rejects.toThrow(/could not find/)
  })
})

describe('a whole book with no markers', () => {
  it('reads from the first chapter file to the last, then fires onRangeEnd', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub')
    expect(t.view.index).toBe(0)
    for (let i = 0; i < 4 * PAGES - 1; i++) await t.engine.next()
    expect(t.view.index).toBe(3)
    expect(t.locations.at(-1)?.atEnd).toBe(true)
    await t.engine.next()
    expect(t.ends).toBe(1)
  })
})

describe('a whole book that begins with an empty chapter file', () => {
  it('opens on the first chapter file that has words, and never goes back to the empty one', async () => {
    const view = new FakeView(['<p> </p>', ...BOOK])
    const engine = new FoliateReaderEngine({
      container: document.createElement('div'),
      createView: async () => view,
      prefersDark: () => false,
      fontFaceCss: () => '',
    })
    await engine.open('/texts/pg-1.epub')
    expect(view.index).toBe(1)
    await engine.prev()
    expect(view.prevCalls).toBe(0)
    expect(view.loaded).toEqual([1])
  })
})

describe('style, callbacks and closing', () => {
  it('sends the font, size and theme to the book and colours the page behind it', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_A)
    t.engine.setStyle({ font: 'literata', sizeStep: 7, theme: 'sepia' })
    const css = t.view.renderer.css.at(-1)!
    expect(css).toContain('/* fonts */')
    expect(css).toContain('22px')
    expect(css).toContain(THEME_COLORS.sepia.text)
    expect(t.container.style.backgroundColor).not.toBe('')
  })

  it('lets a callback be removed', async () => {
    const t = setup()
    const seen: LocationInfo[] = []
    const stop = t.engine.onLocation((l) => seen.push(l))
    await t.engine.open('/texts/pg-1.epub', STORY_A)
    const before = seen.length
    stop()
    await t.engine.next()
    expect(seen).toHaveLength(before)
  })

  it('closes the view and ignores page turns afterwards', async () => {
    const t = setup()
    await t.engine.open('/texts/pg-1.epub', STORY_A)
    t.engine.close()
    expect(t.view.closed).toBe(true)
    await t.engine.next()
    expect(t.view.nextCalls).toBe(0)
  })
})
