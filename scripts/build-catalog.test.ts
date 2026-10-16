// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import {
  type BaseEntry,
  type BuildResult,
  type CatalogEntry,
  CONTENT_NOTES,
  FORMS,
  GENRES,
  MOODS,
  buildCatalog,
  countSentences,
  countSyllables,
  countWords,
  coverSvg,
  eraBandFor,
  findFirstLine,
  firstSentence,
  formForWordCount,
  lengthClassFor,
  locate,
  mergeCuration,
  parseCsv,
  readingBandFor,
  readingLevelFor,
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
  'readingLevel',
  'year',
  'eraBand',
  'form',
  'genres',
  'moods',
  'contentNotes',
  'hook',
  'blurb',
  'generatedBy',
  'reviewed',
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
        if (typeof value === 'string') {
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

  it('has both hrefs for every entry, and single works start at their own title', () => {
    for (const e of result.entries) {
      expect(e.startHref, e.id).toMatch(/^[^#]+(#.+)?$/)
      expect(e.endHref, e.id).toBeTruthy()
      if (!e.isCollection) {
        // An anchor on the title heading after the Project Gutenberg START line.
        expect(e.startHref, e.id).toContain('#')
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
      expect(e.lengthClass, e.id).toBe(lengthClassFor(e.wordCount / 238))
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

const ESSAYS = new Set([
  'pg-71-on-the-duty-of-civil-disobedience',
  'pg-1080-a-modest-proposal',
  'pg-2944-compensation',
  'pg-3172-fenimore-coopers-literary-offences',
  'pg-16643-self-reliance',
])

const CURATION_KEYS = [
  'year',
  'eraBand',
  'form',
  'genres',
  'moods',
  'contentNotes',
  'hook',
  'blurb',
  'generatedBy',
  'reviewed',
] as const

function splitEntry(entry: CatalogEntry): {
  base: BaseEntry
  record: Record<string, unknown>
} {
  const base: Record<string, unknown> = { ...entry }
  const record: Record<string, unknown> = {}
  for (const key of CURATION_KEYS) {
    record[key] = base[key]
    delete base[key]
  }
  return { base: base as unknown as BaseEntry, record }
}

describe('curation in the catalog', () => {
  it('has complete, valid curation on every entry', () => {
    for (const e of result.entries) {
      expect(e.year, e.id).toBeGreaterThan(1500)
      expect(eraBandFor(e.year), e.id).toBe(e.eraBand)
      expect(FORMS, e.id).toContain(e.form)
      expect(e.genres.length, e.id).toBeGreaterThanOrEqual(1)
      expect(e.genres.length, e.id).toBeLessThanOrEqual(3)
      expect(e.moods.length, e.id).toBeGreaterThanOrEqual(1)
      expect(e.moods.length, e.id).toBeLessThanOrEqual(3)
      for (const g of e.genres) expect(GENRES).toContain(g)
      for (const m of e.moods) expect(MOODS).toContain(m)
      for (const n of e.contentNotes) expect(CONTENT_NOTES).toContain(n)
      expect(countWords(e.hook), e.id).toBeLessThanOrEqual(20)
      expect(countWords(e.blurb), e.id).toBeLessThanOrEqual(60)
      expect(e.generatedBy, e.id).toBeTruthy()
      expect(typeof e.reviewed, e.id).toBe('boolean')
    }
  })

  it('uses the form rule: fiction by word count, non-fiction as essay', () => {
    for (const e of result.entries) {
      if (ESSAYS.has(e.id)) {
        expect(e.form, e.id).toBe('essay')
      } else {
        expect(e.form, e.id).toBe(formForWordCount(e.wordCount))
      }
    }
    expect(formForWordCount(7499)).toBe('story')
    expect(formForWordCount(7500)).toBe('novelette')
    expect(formForWordCount(17499)).toBe('novelette')
    expect(formForWordCount(17500)).toBe('novella')
  })

  it('never copies six or more words in a row from the story into a hook or blurb', () => {
    const words = (s: string): string[] =>
      (
        s.match(
          /[A-Za-z0-9\u00C0-\uFFFF]+(?:['\u2019-][A-Za-z0-9\u00C0-\uFFFF]+)*/g,
        ) ?? []
      ).map((w) => w.toLowerCase().replace(/\u2019/g, "'"))
    for (const e of result.entries) {
      const text = words(result.rangeText[e.id])
      const grams = new Set<string>()
      for (let i = 0; i + 6 <= text.length; i++)
        grams.add(text.slice(i, i + 6).join(' '))
      for (const label of ['hook', 'blurb'] as const) {
        const mine = words(e[label])
        for (let i = 0; i + 6 <= mine.length; i++) {
          expect(
            grams.has(mine.slice(i, i + 6).join(' ')),
            `${e.id} ${label}`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('mergeCuration', () => {
  const sample = (): { base: BaseEntry; record: Record<string, unknown> } =>
    splitEntry(result.entries[0])
  const withRecord = (
    record: Record<string, unknown>,
    base = sample().base,
  ): unknown[] => [base, { schemaVersion: 1, entries: { [base.id]: record } }]

  it('accepts a good record', () => {
    const { base, record } = sample()
    const merged = mergeCuration([base], {
      schemaVersion: 1,
      entries: { [base.id]: record },
    })
    expect(merged[0].hook).toBe(record.hook)
  })

  it('stops when an entry has no curation record', () => {
    const { base } = sample()
    expect(() =>
      mergeCuration([base], { schemaVersion: 1, entries: {} }),
    ).toThrow(/no curation record/)
  })

  it('stops when a record belongs to no catalog entry', () => {
    const { base, record } = sample()
    const file = {
      schemaVersion: 1,
      entries: { [base.id]: record, 'pg-0-ghost': record },
    }
    expect(() => mergeCuration([base], file)).toThrow(/not a catalog entry/)
  })

  it('rejects values outside the lists and limits', () => {
    const { base, record } = sample()
    const bad = (change: Record<string, unknown>) => {
      const [b, file] = withRecord({ ...record, ...change }, base)
      return () => mergeCuration([b as BaseEntry], file)
    }
    expect(bad({ genres: ['cooking'] })).toThrow(/not an allowed genres/)
    expect(bad({ genres: [] })).toThrow(/genres needs 1 to 3/)
    expect(bad({ moods: ['cozy', 'eerie', 'funny', 'dark'] })).toThrow(
      /moods needs 1 to 3/,
    )
    expect(bad({ contentNotes: ['boredom'] })).toThrow(
      /not an allowed contentNotes/,
    )
    expect(bad({ hook: 'word '.repeat(21) })).toThrow(/hook has 21 words/)
    expect(bad({ blurb: 'word '.repeat(61) })).toThrow(/blurb has 61 words/)
    expect(bad({ blurb: '' })).toThrow(/blurb is missing/)
    expect(bad({ reviewed: 'no' })).toThrow(/reviewed must be/)
    expect(bad({ generatedBy: '' })).toThrow(/generatedBy is missing/)
  })

  it('rejects a year outside its era band and a form that breaks the word rule', () => {
    const { base, record } = sample()
    const bad = (change: Record<string, unknown>) => {
      const [b, file] = withRecord({ ...record, ...change }, base)
      return () => mergeCuration([b as BaseEntry], file)
    }
    expect(bad({ year: 1700, eraBand: '1850-1899' })).toThrow(
      /not in the era band/,
    )
    expect(bad({ year: 1950, eraBand: '1900-1930' })).toThrow(
      /not in the era band/,
    )
    const wrong = base.wordCount < 7500 ? 'novella' : 'story'
    expect(bad({ form: wrong })).toThrow(/is a/)
  })
})

describe('reading level', () => {
  it('sorts grades into bands', () => {
    expect(readingBandFor(0)).toBe('easy')
    expect(readingBandFor(6)).toBe('easy')
    expect(readingBandFor(7)).toBe('medium')
    expect(readingBandFor(10)).toBe('medium')
    expect(readingBandFor(11)).toBe('challenging')
  })

  it('counts syllables and sentences', () => {
    expect(countSyllables('cat')).toBe(1)
    expect(countSyllables('water')).toBe(2)
    expect(countSyllables('little')).toBe(2)
    expect(countSyllables('family')).toBe(3)
    expect(countSyllables('well-known')).toBe(2)
    expect(
      countSentences(
        'Mr. Holmes sat down. He spoke! Why? Because $1.87 was left...',
      ),
    ).toBe(4)
  })

  it('works out the Flesch-Kincaid grade from the text', () => {
    const plain =
      'The cat sat on the mat. The dog ran to the man. It was a fun day.'
    expect(readingLevelFor(plain)).toEqual({ grade: 0, band: 'easy' })
    const dense =
      'Notwithstanding considerable institutional resistance, the administration systematically ' +
      'reconsidered its fundamental philosophical assumptions concerning governmental responsibility.'
    expect(readingLevelFor(dense).band).toBe('challenging')
  })

  it('gives every entry a grade and band that agree', () => {
    for (const e of result.entries) {
      expect(e.readingLevel.grade, e.id).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(e.readingLevel.grade), e.id).toBe(true)
      expect(e.readingLevel.band, e.id).toBe(
        readingBandFor(e.readingLevel.grade),
      )
      expect(readingLevelFor(result.rangeText[e.id]), e.id).toEqual(
        e.readingLevel,
      )
    }
  })
})
