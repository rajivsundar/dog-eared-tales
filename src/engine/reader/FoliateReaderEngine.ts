// The only file that talks to foliate-js. See README.md in this folder for how it works.
import { fontFaceCss as packagedFontFaceCss } from './fonts'
import {
  DEFAULT_WORDS_PER_MINUTE,
  type PagePosition,
  type StoryRange,
  buildRange,
  clampTarget,
  isFirstPage,
  isLastPage,
  nextMove,
  placeSection,
  prevMove,
  progressAt,
} from './rangeRules'
import { THEME_COLORS, readerCss, resolveTheme } from './readerStyle'
import { removeBefore, removeFrom } from './trimDocument'
import type {
  LocationInfo,
  OpenOptions,
  ReaderEngine,
  ReaderStyle,
} from './types'
import { countWords } from './words'

// The small part of foliate-js that we use. Declared here so tests can supply a pretend one.
export interface FoliateTarget {
  index: number
  anchor?: ((doc: Document) => Node | Range | null) | number
}
export interface FoliateSection {
  linear?: string
  createDocument?: () => Promise<Document>
}
export interface FoliateBook {
  sections: FoliateSection[]
  resolveHref(href: string): FoliateTarget | null | undefined
}
export interface FoliateRenderer extends EventTarget {
  setStyles(css: string): void
  goTo(target: FoliateTarget): Promise<unknown>
}
export interface FoliateView extends EventTarget {
  book: FoliateBook
  renderer: FoliateRenderer
  open(book: string | Blob): Promise<void>
  close(): void
  remove?(): void
  goTo(target: string | number): Promise<unknown>
  goToTextStart(): Promise<unknown>
  next(): Promise<void>
  prev(): Promise<void>
  getCFI(index: number, range?: Range): string
  resolveNavigation(target: string): FoliateTarget | null | undefined
}

export interface FoliateEngineOptions {
  /** Where the book is drawn. */
  container: HTMLElement
  /** Supplies the foliate-js view. Tests pass a pretend one. */
  createView?: () => Promise<FoliateView>
  prefersDark?: () => boolean
  fontFaceCss?: () => string
}

interface PageEvent {
  index: number
  range?: Range
  fraction?: number
  size?: number
}

function detailOf<T>(event: Event): T {
  return (event as CustomEvent<T>).detail
}

function nodeAt(target: FoliateTarget, doc: Document): Node | Range | null {
  if (typeof target.anchor !== 'function') return null
  return target.anchor(doc) ?? null
}

export class FoliateReaderEngine implements ReaderEngine {
  #options: FoliateEngineOptions
  #view: FoliateView | null = null
  #range: StoryRange | null = null
  #start: { href: string; target: FoliateTarget } | null = null
  #end: { href: string; target: FoliateTarget } | null = null
  #wordsPerMinute = DEFAULT_WORDS_PER_MINUTE
  #style: ReaderStyle = { font: 'literata', sizeStep: 5, theme: 'system' }
  #last: PagePosition | null = null
  #locationListeners = new Set<(location: LocationInfo) => void>()
  #endListeners = new Set<() => void>()

  constructor(options: FoliateEngineOptions) {
    this.#options = options
  }

  async open(textUrl: string, options: OpenOptions = {}): Promise<void> {
    this.close()
    this.#wordsPerMinute = options.wordsPerMinute ?? DEFAULT_WORDS_PER_MINUTE
    const view = await (
      this.#options.createView ??
      (() => createFoliateView(this.#options.container))
    )()
    this.#view = view
    view.addEventListener('load', (e) =>
      this.#onLoad(detailOf<{ doc: Document; index: number }>(e)),
    )
    await view.open(textUrl)

    const { startHref, endHref } = options
    if (Boolean(startHref) !== Boolean(endHref)) {
      throw new Error('startHref and endHref must be given together')
    }
    if (startHref && endHref) {
      const start = view.book.resolveHref(startHref)
      const end = view.book.resolveHref(endHref)
      if (!start)
        throw new Error(`startHref not found in the book: ${startHref}`)
      if (!end) throw new Error(`endHref not found in the book: ${endHref}`)
      if (end.index < start.index)
        throw new Error('the story ends before it starts')
      this.#start = { href: startHref, target: start }
      this.#end = { href: endHref, target: end }
    }
    this.#range = await this.#measureRange(view.book)

    view.renderer.addEventListener('relocate', (e) =>
      this.#onRelocate(detailOf<PageEvent>(e)),
    )
    this.#applyStyle()
    if (options.locator) await this.goTo(options.locator)
    else await this.#goToStart()
  }

  async next(): Promise<void> {
    if (!this.#view || !this.#range) return
    if (this.#last && nextMove(this.#range, this.#last) === 'range-end') {
      for (const callback of this.#endListeners) callback()
      return
    }
    await this.#view.next()
  }

  async prev(): Promise<void> {
    if (!this.#view || !this.#range) return
    if (this.#last && prevMove(this.#range, this.#last) === 'stay') return
    await this.#view.prev()
  }

  async goTo(locator: string): Promise<void> {
    const view = this.#view
    const range = this.#range
    if (!view || !range) return
    const target = view.resolveNavigation(locator)
    if (!target) return this.#goToStart()
    switch (clampTarget(range, target.index)) {
      case 'as-asked':
        await view.goTo(locator)
        return
      case 'start':
        return this.#goToStart()
      case 'end':
        await view.renderer.goTo({
          index: range.last,
          anchor: () => 1 as unknown as Node,
        })
    }
  }

  onLocation(callback: (location: LocationInfo) => void): () => void {
    this.#locationListeners.add(callback)
    return () => this.#locationListeners.delete(callback)
  }

  onRangeEnd(callback: () => void): () => void {
    this.#endListeners.add(callback)
    return () => this.#endListeners.delete(callback)
  }

  setStyle(style: ReaderStyle): void {
    this.#style = style
    this.#applyStyle()
  }

  close(): void {
    const view = this.#view
    this.#view = null
    this.#range = null
    this.#start = null
    this.#end = null
    this.#last = null
    if (view) {
      view.close()
      view.remove?.()
    }
  }

  // ---- inside

  #applyStyle(): void {
    const prefersDark =
      this.#options.prefersDark?.() ??
      globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ??
      false
    const fontFaceCss = (this.#options.fontFaceCss ?? packagedFontFaceCss)()
    this.#view?.renderer.setStyles(
      readerCss(this.#style, { prefersDark, fontFaceCss }),
    )
    this.#options.container.style.backgroundColor =
      THEME_COLORS[resolveTheme(this.#style.theme, prefersDark)].background
  }

  async #goToStart(): Promise<void> {
    const view = this.#view
    if (!view) return
    if (this.#start) await view.goTo(this.#start.href)
    else if (this.#range) await view.goTo(this.#range.first)
    else await view.goToTextStart()
  }

  /** Counts the story's words in each chapter file it touches. */
  async #measureRange(book: FoliateBook): Promise<StoryRange> {
    const first = this.#start
      ? this.#start.target.index
      : book.sections.findIndex((s) => s.linear !== 'no')
    const last = this.#end
      ? this.#end.target.index
      : lastLinearIndex(book.sections)
    const sections = []
    for (let index = first; index <= last; index++) {
      const section = book.sections[index]
      if (!section?.createDocument) continue
      sections.push({
        index,
        words: await this.#countSection(await section.createDocument(), index),
      })
    }
    // If the next story begins right at the top of the last chapter file, that file holds none of
    // this story. Leave it out, so the reader never turns to a blank page.
    while (sections.length > 1 && sections[sections.length - 1].words === 0) {
      sections.pop()
    }
    // A whole book can begin with empty chapter files, such as a cover wrapper. Start after them.
    while (!this.#start && sections.length > 1 && sections[0].words === 0) {
      sections.shift()
    }
    return buildRange(sections)
  }

  async #countSection(doc: Document, index: number): Promise<number> {
    if (!doc.body) return 0
    const text = doc.createRange()
    text.selectNodeContents(doc.body)
    if (this.#start && index === this.#start.target.index) {
      const anchor = this.#anchorIn(this.#start, doc)
      text.setStartBefore(
        'startContainer' in anchor ? anchor.startContainer : anchor,
      )
    }
    if (this.#end && index === this.#end.target.index) {
      const anchor = this.#anchorIn(this.#end, doc)
      text.setEndBefore(
        'startContainer' in anchor ? anchor.startContainer : anchor,
      )
    }
    return countWords(text.toString())
  }

  #anchorIn(
    edge: { href: string; target: FoliateTarget },
    doc: Document,
  ): Node | Range {
    const found = nodeAt(edge.target, doc)
    if (!found)
      throw new Error(`could not find ${edge.href} in its chapter file`)
    return found
  }

  /** Runs each time foliate-js loads a chapter file, before it is laid out in pages. */
  #onLoad({ doc, index }: { doc: Document; index: number }): void {
    if (this.#end && index === this.#end.target.index) {
      const anchor = nodeAt(this.#end.target, doc)
      if (anchor) removeFrom(anchor)
    }
    if (this.#start && index === this.#start.target.index) {
      const anchor = nodeAt(this.#start.target, doc)
      if (anchor) removeBefore(anchor)
    }
  }

  #onRelocate({ index, range, fraction = 0, size }: PageEvent): void {
    const story = this.#range
    const view = this.#view
    if (!story || !view) return
    this.#last = { index, fraction, size }
    if (placeSection(story, index) !== 'inside') return

    const doc = range?.startContainer.ownerDocument
    let wordsIntoSection: number
    if (range && doc?.body) {
      const before = doc.createRange()
      before.selectNodeContents(doc.body)
      before.setEnd(range.startContainer, range.startOffset)
      wordsIntoSection = countWords(before.toString())
    } else {
      wordsIntoSection =
        fraction * (story.sections.find((s) => s.index === index)?.words ?? 0)
    }

    const progress = progressAt(
      story,
      index,
      wordsIntoSection,
      this.#wordsPerMinute,
    )
    const location: LocationInfo = {
      locator: view.getCFI(index, range),
      fraction: progress.fraction,
      wordsLeft: progress.wordsLeft,
      minutesLeft: progress.minutesLeft,
      atStart: index === story.first && isFirstPage(fraction),
      atEnd: index === story.last && isLastPage(fraction, size),
    }
    for (const callback of this.#locationListeners) callback(location)
  }
}

function lastLinearIndex(sections: FoliateSection[]): number {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].linear !== 'no') return i
  }
  return -1
}

async function createFoliateView(container: HTMLElement): Promise<FoliateView> {
  await import('foliate-js/view.js')
  const view = document.createElement(
    'foliate-view',
  ) as unknown as FoliateView & HTMLElement
  container.append(view)
  return view
}
