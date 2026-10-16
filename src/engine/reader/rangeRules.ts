// The rules for reading one story that sits inside a longer book.
// Everything here is plain arithmetic, with no browser and no foliate-js, so it is easy to test.
//
// A "range" is the part of the book that belongs to the story. It can sit inside one chapter
// file or run across several. Positions are counted in words from the start of the story.

export const DEFAULT_WORDS_PER_MINUTE = 238

/** How close to the edge of a chapter counts as "on the first or last page". */
const EDGE = 0.001

export interface RangeSection {
  /** The chapter file's position in the book. */
  index: number
  /** How many words of the story are in this chapter file. */
  words: number
}

export interface StoryRange {
  first: number
  last: number
  sections: RangeSection[]
  totalWords: number
}

export function buildRange(sections: RangeSection[]): StoryRange {
  if (sections.length === 0)
    throw new Error('a story range needs at least one chapter file')
  const sorted = [...sections].sort((a, b) => a.index - b.index)
  return {
    first: sorted[0].index,
    last: sorted[sorted.length - 1].index,
    sections: sorted,
    totalWords: sorted.reduce((sum, s) => sum + s.words, 0),
  }
}

export type Placement = 'before' | 'inside' | 'after'

/** Is this chapter file before the story, part of it, or after it? */
export function placeSection(range: StoryRange, index: number): Placement {
  if (index < range.first) return 'before'
  if (index > range.last) return 'after'
  return 'inside'
}

export function minutesLeftFor(
  wordsLeft: number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): number {
  if (wordsLeft <= 0) return 0
  return Math.ceil(wordsLeft / wordsPerMinute)
}

export interface Progress {
  wordsRead: number
  wordsLeft: number
  /** 0 to 1 within the story. */
  fraction: number
  minutesLeft: number
}

/**
 * Progress inside the story only, never the whole book.
 * `wordsIntoSection` is how many of the story's words come before the reader in this chapter file.
 */
export function progressAt(
  range: StoryRange,
  index: number,
  wordsIntoSection: number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): Progress {
  let wordsRead = 0
  for (const section of range.sections) {
    if (section.index < index) wordsRead += section.words
    else if (section.index === index)
      wordsRead += Math.min(Math.max(0, wordsIntoSection), section.words)
  }
  const total = range.totalWords
  const wordsLeft = Math.max(0, total - wordsRead)
  return {
    wordsRead,
    wordsLeft,
    fraction: total > 0 ? Math.min(1, wordsRead / total) : 0,
    minutesLeft: minutesLeftFor(wordsLeft, wordsPerMinute),
  }
}

/** `fraction` is how far through the chapter file the page starts, as foliate-js reports it. */
export function isFirstPage(fraction: number): boolean {
  return fraction <= EDGE
}

/** `size` is the share of the chapter file that one page covers. */
export function isLastPage(fraction: number, size = 0): boolean {
  return fraction + size >= 1 - EDGE
}

export interface PagePosition {
  index: number
  fraction: number
  size?: number
}

/** On the last page of the story, "next" ends the story instead of turning the page. */
export function nextMove(
  range: StoryRange,
  at: PagePosition,
): 'turn' | 'range-end' {
  if (at.index >= range.last && isLastPage(at.fraction, at.size))
    return 'range-end'
  return 'turn'
}

/** On the first page of the story, "previous" does nothing. */
export function prevMove(range: StoryRange, at: PagePosition): 'turn' | 'stay' {
  if (at.index <= range.first && isFirstPage(at.fraction)) return 'stay'
  return 'turn'
}

/** Where a jump should land: as asked, at the start of the story, or at the end of it. */
export function clampTarget(
  range: StoryRange,
  index: number,
): 'as-asked' | 'start' | 'end' {
  const placement = placeSection(range, index)
  if (placement === 'before') return 'start'
  if (placement === 'after') return 'end'
  return 'as-asked'
}
