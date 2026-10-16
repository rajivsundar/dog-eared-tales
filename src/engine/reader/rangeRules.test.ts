import { describe, expect, it } from 'vitest'
import {
  buildRange,
  clampTarget,
  isFirstPage,
  isLastPage,
  minutesLeftFor,
  nextMove,
  placeSection,
  prevMove,
  progressAt,
} from './rangeRules'

// A story that starts in chapter file 4 and ends in chapter file 6.
const story = buildRange([
  { index: 4, words: 1000 },
  { index: 5, words: 2000 },
  { index: 6, words: 1000 },
])
// A story that sits inside one chapter file.
const short = buildRange([{ index: 2, words: 476 }])

describe('where a chapter file sits', () => {
  it('knows before, inside and after', () => {
    expect(placeSection(story, 3)).toBe('before')
    expect(placeSection(story, 4)).toBe('inside')
    expect(placeSection(story, 6)).toBe('inside')
    expect(placeSection(story, 7)).toBe('after')
  })

  it('needs at least one chapter file', () => {
    expect(() => buildRange([])).toThrow()
  })
})

describe('never paging before the start', () => {
  it('stays on the first page of the first chapter file', () => {
    expect(prevMove(story, { index: 4, fraction: 0 })).toBe('stay')
    expect(prevMove(short, { index: 2, fraction: 0 })).toBe('stay')
  })

  it('turns back everywhere else', () => {
    expect(prevMove(story, { index: 4, fraction: 0.5 })).toBe('turn')
    expect(prevMove(story, { index: 5, fraction: 0 })).toBe('turn')
  })
})

describe('never paging past the end', () => {
  it('ends the story on the last page of the last chapter file', () => {
    expect(nextMove(story, { index: 6, fraction: 0.9, size: 0.1 })).toBe(
      'range-end',
    )
    expect(nextMove(short, { index: 2, fraction: 0.75, size: 0.25 })).toBe(
      'range-end',
    )
  })

  it('turns the page everywhere else', () => {
    expect(nextMove(story, { index: 6, fraction: 0.5, size: 0.1 })).toBe('turn')
    // The last page of a chapter file in the middle of the story is not the end of the story.
    expect(nextMove(story, { index: 5, fraction: 0.9, size: 0.1 })).toBe('turn')
    expect(nextMove(story, { index: 4, fraction: 0.9, size: 0.1 })).toBe('turn')
  })

  it('treats a page past the last chapter file as the end too', () => {
    expect(nextMove(story, { index: 7, fraction: 0, size: 0.1 })).toBe('turn')
    expect(nextMove(story, { index: 7, fraction: 0.95, size: 0.05 })).toBe(
      'range-end',
    )
  })

  it('recognises the first and last pages', () => {
    expect(isFirstPage(0)).toBe(true)
    expect(isFirstPage(0.2)).toBe(false)
    expect(isLastPage(0.8, 0.2)).toBe(true)
    expect(isLastPage(0.6, 0.2)).toBe(false)
  })
})

describe('jumps outside the story', () => {
  it('moves a place before the story to the start and after it to the end', () => {
    expect(clampTarget(story, 0)).toBe('start')
    expect(clampTarget(story, 3)).toBe('start')
    expect(clampTarget(story, 5)).toBe('as-asked')
    expect(clampTarget(story, 7)).toBe('end')
  })
})

describe('progress and minutes left, inside the story only', () => {
  it('starts at zero with the whole story left', () => {
    expect(progressAt(story, 4, 0)).toEqual({
      wordsRead: 0,
      wordsLeft: 4000,
      fraction: 0,
      minutesLeft: 17, // 4000 / 238, rounded up
    })
  })

  it('counts earlier chapter files in full and this one by how far in you are', () => {
    const p = progressAt(story, 5, 500)
    expect(p.wordsRead).toBe(1500)
    expect(p.fraction).toBeCloseTo(0.375)
    expect(p.wordsLeft).toBe(2500)
    expect(p.minutesLeft).toBe(11) // 2500 / 238 = 10.5
  })

  it('does not count the rest of the book', () => {
    // The book may have a million words. Only the story's 4,000 matter.
    expect(progressAt(story, 6, 1000).fraction).toBe(1)
    expect(progressAt(story, 6, 1000).minutesLeft).toBe(0)
  })

  it('stays between 0 and 1 even if the page reports too many or too few words', () => {
    expect(progressAt(story, 6, 99999).fraction).toBe(1)
    expect(progressAt(story, 4, -5).fraction).toBe(0)
  })

  it('works in a story inside one chapter file', () => {
    const p = progressAt(short, 2, 238)
    expect(p.wordsLeft).toBe(238)
    expect(p.minutesLeft).toBe(1)
  })

  it('uses the reader’s own speed when given', () => {
    expect(minutesLeftFor(2380, 238)).toBe(10)
    expect(minutesLeftFor(2380, 119)).toBe(20)
    expect(minutesLeftFor(0)).toBe(0)
  })
})
