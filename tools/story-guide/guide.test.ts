import { describe, expect, it } from 'vitest'
import { firstThird, parseModelJson } from './guide.ts'

const paragraph = (word: string, count: number): string =>
  Array.from({ length: count }, (_, i) => `${word}${i}`).join(' ')

describe('firstThird', () => {
  it('keeps whole paragraphs and never reaches the ending', () => {
    const story = [
      paragraph('opening', 30),
      paragraph('middle', 30),
      paragraph('ending', 30),
    ].join('\n\n')
    const third = firstThird(story)
    expect(third.totalWords).toBe(90)
    expect(third.words).toBe(30)
    expect(third.text).toContain('opening0')
    expect(third.text).not.toContain('middle')
    expect(third.text).not.toContain('ending')
  })

  it('stops at the last paragraph that fits inside a third', () => {
    // 4 x 25 words = 100 words, so a third is 33: only one whole paragraph fits.
    const story = Array.from({ length: 4 }, (_, i) =>
      paragraph(`p${i}w`, 25),
    ).join('\n\n')
    const third = firstThird(story)
    expect(third.words).toBeLessThanOrEqual(Math.floor(third.totalWords / 3))
    expect(third.text).toBe(paragraph('p0w', 25))
  })

  it('cuts a long first paragraph at a sentence end, inside the limit', () => {
    const sentence = (n: number) => `${paragraph(`s${n}x`, 10)}.`
    const story = Array.from({ length: 9 }, (_, i) => sentence(i)).join(' ')
    const third = firstThird(story)
    expect(third.totalWords).toBe(90)
    expect(third.words).toBeLessThanOrEqual(30)
    expect(third.text.endsWith('.')).toBe(true)
    expect(third.text).not.toContain('s5x')
  })

  it('returns nothing for a text too short to have a third', () => {
    expect(firstThird('Just two').text).toBe('')
  })
})

describe('parseModelJson', () => {
  it('strips code fences and text around the object', () => {
    const reply = 'Here you go:\n```json\n{"hook": "A hook", "n": 1}\n```'
    expect(parseModelJson(reply)).toEqual({ hook: 'A hook', n: 1 })
  })

  it('returns null for text that is not a JSON object', () => {
    expect(parseModelJson('not json')).toBeNull()
    expect(parseModelJson('{"broken": ')).toBeNull()
    expect(parseModelJson('[1, 2]')).toBeNull()
  })
})
