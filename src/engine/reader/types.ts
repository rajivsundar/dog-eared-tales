import type { FontChoice, ThemeChoice } from '../../stores'

export interface OpenOptions {
  /** Where the story starts inside the EPUB (a path and anchor). Leave out to open the whole book. */
  startHref?: string | null
  /** Where the next story starts, so this one ends. Leave out to open the whole book. */
  endHref?: string | null
  /** Text where the story really starts in its first chapter file; everything before it is cut. */
  startAtText?: string | null
  /** Text where the story really ends in its last chapter file; it and everything after it is cut. */
  endBeforeText?: string | null
  /** A place to resume from, as saved by an earlier onLocation callback. */
  locator?: string | null
  /** The reader's own speed. Defaults to 238 words per minute. */
  wordsPerMinute?: number
}

/** Where the reader is, measured inside the story's own range only. */
export interface LocationInfo {
  /** Save this and pass it back to open() or goTo() to return to the same place. */
  locator: string
  /** 0 at the start of the story, 1 at the end. */
  fraction: number
  wordsLeft: number
  minutesLeft: number
  /** True on the first page of the story. */
  atStart: boolean
  /** True on the last page of the story. */
  atEnd: boolean
}

export interface ReaderStyle {
  font: FontChoice
  /** 1 to 10. */
  sizeStep: number
  theme: ThemeChoice
}

export interface ReaderEngine {
  open(textUrl: string, options?: OpenOptions): Promise<void>
  /** Turns the page. On the last page of a story it fires onRangeEnd instead. */
  next(): Promise<void>
  /** Turns back a page. On the first page of a story it does nothing. */
  prev(): Promise<void>
  /** Jumps to a saved locator. A place outside the story moves to the nearest edge of it. */
  goTo(locator: string): Promise<void>
  /** Returns a function that stops the callback. */
  onLocation(callback: (location: LocationInfo) => void): () => void
  onRangeEnd(callback: () => void): () => void
  setStyle(style: ReaderStyle): void
  close(): void
}
