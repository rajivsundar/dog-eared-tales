// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import {
  type BuildResult,
  buildCatalog,
  coverSvg,
  findFirstLine,
  firstSentence,
  lengthClassFor,
  locate,
  parseCsv,
  slugify,
} from './build-catalog.ts'

// Word counts of the story text only (Project Gutenberg header, footer and licence removed).
// Collection entries are from the inventory table. For the 13 single works and The Dead the
// inventory had counted Gutenberg's header and footer inside the book file (about 200 words),
// so these numbers were re-measured with a separate Python script that cuts at the
// "*** START OF" and "*** END OF" lines.
const INVENTORY: Record<string, number> = {
  'pg-35-the-time-machine': 32646,
  'pg-71-on-the-duty-of-civil-disobedience': 9424,
  'pg-269-the-open-window': 1244,
  'pg-375-an-occurrence-at-owl-creek-bridge': 3775,
  'pg-396-the-lady-or-the-tiger': 2728,
  'pg-512-the-birthmark': 6544,
  'pg-512-rappaccinis-daughter': 11507,
  'pg-932-the-fall-of-the-house-of-usher': 7127,
  'pg-1063-the-cask-of-amontillado': 2344,
  'pg-1064-the-masque-of-the-red-death': 2425,
  'pg-1080-a-modest-proposal': 3420,
  'pg-1289-the-signal-man': 5214,
  'pg-1661-a-scandal-in-bohemia': 8809,
  'pg-1661-the-red-headed-league': 9360,
  'pg-1952-the-yellow-wallpaper': 6128,
  'pg-2148-the-tell-tale-heart': 2104,
  'pg-2148-the-purloined-letter': 7157,
  'pg-2776-the-cop-and-the-anthem': 2293,
  'pg-2814-araby': 2346,
  'pg-2814-the-dead': 15984,
  'pg-2944-compensation': 7628,
  'pg-3172-fenimore-coopers-literary-offences': 4914,
  'pg-7256-the-gift-of-the-magi': 2095,
  'pg-12122-the-monkeys-paw': 4113,
  'pg-13415-the-lady-with-the-dog': 6612,
  'pg-14522-the-canterville-ghost': 11629,
  'pg-16643-self-reliance': 10275,
  'pg-36238-the-mantle': 11113,
}

const FIELDS = [
  'id',
  'title',
  'author',
  'language',
  'bookTitle',
  'isCollection',
  'wordCount',
  'readingMinutes',
  'lengthClass',
  'firstLine',
  'textUrl',
  'coverUrl',
  'startHref',
  'endHref',
  'sha256',
  'source',
  'sourceUrl',
  'license',
] as const

let result: BuildResult

beforeAll(() => {
  result = buildCatalog()
}, 60_000)

describe('catalog entries', () => {
  it('has the 28 expected entries', () => {
    expect(result.entries.map((e) => e.id).sort()).toEqual(
      Object.keys(INVENTORY).sort(),
    )
    expect(result.epubs.size).toBe(24)
  })

  it('gives every entry every field', () => {
    for (const entry of result.entries) {
      for (const field of FIELDS) {
        expect(entry, `${entry.id}.${field}`).toHaveProperty(field)
        const value = entry[field]
        if (field === 'startHref' || field === 'endHref') {
          expect(
            value === null || (typeof value === 'string' && value !== ''),
          ).toBe(true)
        } else if (typeof value === 'string') {
          expect(value, `${entry.id}.${field}`).not.toBe('')
        }
      }
      expect(entry.wordCount).toBeGreaterThan(0)
      expect(entry.readingMinutes).toBeGreaterThanOrEqual(1)
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(entry.textUrl).toMatch(/^\/texts\/pg-\d+\.epub$/)
      expect(entry.coverUrl).toBe(`/covers/${entry.id}.svg`)
      expect(entry.license).toBe('Project Gutenberg License')
    }
  })

  it('has both hrefs for collection entries and none for single works', () => {
    for (const e of result.entries) {
      if (e.isCollection) {
        expect(e.startHref, e.id).toBeTruthy()
        expect(e.endHref, e.id).toBeTruthy()
      } else {
        expect(e.startHref, e.id).toBeNull()
        expect(e.endHref, e.id).toBeNull()
      }
    }
  })

  it('has word counts within 2% of the inventory', () => {
    for (const e of result.entries) {
      const expected = INVENTORY[e.id]
      expect(
        Math.abs(e.wordCount - expected) / expected,
        e.id,
      ).toBeLessThanOrEqual(0.02)
    }
  })

  it('takes every firstLine word for word from the story text', () => {
    const squash = (s: string): string => s.replace(/\s+/g, ' ')
    for (const e of result.entries) {
      expect(squash(result.rangeText[e.id]), e.id).toContain(
        squash(e.firstLine),
      )
    }
  })

  it('computes length classes from the unrounded reading time', () => {
    for (const e of result.entries) {
      expect(e.lengthClass, e.id).toBe(lengthClassFor(e.wordCount / 230))
    }
  })
})

describe('helpers', () => {
  it('sorts reading times into length classes', () => {
    expect(lengthClassFor(9.9)).toBe('under10')
    expect(lengthClassFor(10)).toBe('10to30')
    expect(lengthClassFor(29.9)).toBe('10to30')
    expect(lengthClassFor(30)).toBe('30to60')
    expect(lengthClassFor(60)).toBe('60plus')
  })

  it('makes slugs', () => {
    expect(slugify("Rappaccini's Daughter")).toBe('rappaccinis-daughter')
    expect(slugify('The Lady, or the Tiger?')).toBe('the-lady-or-the-tiger')
    expect(slugify('Sitôt')).toBe('sitot')
  })

  it('finds the first sentence without splitting at abbreviations or inside quotes', () => {
    expect(firstSentence('Mr. Holmes sat down. He spoke.')).toBe(
      'Mr. Holmes sat down.',
    )
    expect(firstSentence('“Halloa! Below there!” He looked up.')).toBe(
      '“Halloa! Below there!”',
    )
    expect(
      firstSentence(
        'True!—nervous—very nervous I had been; but why? Never mind.',
      ),
    ).toBe('True!—nervous—very nervous I had been; but why?')
  })

  it('skips marked lines (headings, epigraphs) when finding the first line', () => {
    const text =
      '\n\u0001THE TITLE\n\u0001An epigraph that is long enough.\nThe real start is here. And more.\n'
    expect(findFirstLine(text)).toBe('The real start is here.')
  })

  it('reads CSV with quotes', () => {
    expect(parseCsv('a,b\n"x, y",2\n')).toEqual([{ a: 'x, y', b: '2' }])
  })

  it('stops with a clear error when an href is not in the book', () => {
    const stream = '\0OEBPS/a.xhtml\0text\0OEBPS/a.xhtml#one\0more'
    expect(
      locate({ stream }, 'OEBPS/a.xhtml#one', 'book.epub'),
    ).toBeGreaterThan(0)
    expect(() => locate({ stream }, 'OEBPS/a.xhtml#nope', 'book.epub')).toThrow(
      /href not found/,
    )
    expect(() => locate({ stream }, 'OEBPS/b.xhtml', 'book.epub')).toThrow(
      /href not found/,
    )
  })

  it('makes a cover with the title and author, escaped', () => {
    const svg = coverSvg('Tom & Jerry <1>', 'A. Author')
    expect(svg).toContain('Tom &amp; Jerry &lt;1&gt;')
    expect(svg).toContain('A. Author')
  })
})
