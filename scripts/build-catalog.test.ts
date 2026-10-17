// @vitest-environment node
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  type BaseEntry,
  type BuildResult,
  type CatalogEntry,
  CONTENT_NOTES,
  FORMS,
  GENRES,
  MOODS,
  YEAR_BASES,
  buildCatalog,
  countSentences,
  countSyllables,
  countWords,
  coverSvg,
  cutAtText,
  stripIllustrationPlaceholders,
  eraBandFor,
  findFirstLine,
  firstSentence,
  formForWordCount,
  lengthClassFor,
  locate,
  loadCuration,
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

/** The curation records in content/curation.json, by entry id. */
function curationRecords(): Record<
  string,
  { reviewed?: boolean; review?: string }
> {
  const file = JSON.parse(
    readFileSync(new URL('../content/curation.json', import.meta.url), 'utf8'),
  ) as {
    entries: Record<string, { reviewed?: boolean; review?: string }>
  }
  return file.entries
}

const EPUB_NUMBER = /^\/texts\/pg-(\d+)\.epub$/

describe('which entries ship', () => {
  it('ships the rows with a reviewed human record, or an auto record that was not held back', () => {
    const records = curationRecords()
    const held = new Set(result.heldBack.map((h) => h.id))
    const expected = result.base
      .filter((b) => {
        const r = records[b.id]
        if (!r) return false
        return r.review === 'auto' ? !held.has(b.id) : r.reviewed === true
      })
      .map((b) => b.id)
      .sort()
    expect(result.entries.map((e) => e.id).sort()).toEqual(expected)
    expect(result.entries.length).toBeGreaterThan(0)
  })

  it('builds and checks every row of sources.csv, shipped or not', () => {
    const csv = readFileSync(
      new URL('../content/sources.csv', import.meta.url),
      'utf8',
    )
    expect(result.base).toHaveLength(parseCsv(csv).length)
    expect(new Set(result.base.map((b) => b.id)).size).toBe(result.base.length)
    expect(result.entries.length + result.skipped.length).toBe(
      result.base.length,
    )
  })

  it('holds back every row without a reviewed record, and says so', () => {
    const records = curationRecords()
    const shipped = new Set(result.entries.map((e) => e.id))
    for (const b of result.skipped) {
      expect(shipped.has(b.id), b.id).toBe(false)
      expect(records[b.id]?.reviewed === true, b.id).toBe(false)
    }
  })

  it('publishes only the books of entries that ship', () => {
    const numbers = new Set(
      result.entries.map((e) => EPUB_NUMBER.exec(e.textUrl)?.[1]),
    )
    expect(new Set(result.epubs.keys())).toEqual(numbers)
    expect(result.epubs.size).toBeGreaterThan(0)
  })

  it('still ships the original 28 entries', () => {
    const shipped = new Set(result.entries.map((e) => e.id))
    for (const id of Object.keys(INVENTORY))
      expect(shipped.has(id), id).toBe(true)
  })
})

describe('every row of sources.csv (including the ones not shipped yet)', () => {
  it('has a real range: hrefs, a first line from the text, and a positive word count', () => {
    const squash = (s: string): string => s.replace(/\s+/g, ' ')
    for (const b of result.base) {
      expect(b.startHref, b.id).toBeTruthy()
      expect(b.endHref, b.id).toBeTruthy()
      expect(b.wordCount, b.id).toBeGreaterThan(0)
      expect(squash(result.rangeText[b.id]), b.id).toContain(
        squash(b.firstLine),
      )
      expect(b.textUrl, b.id).toMatch(EPUB_NUMBER)
      expect(b.sha256, b.id).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('never lets a story run into the next one or into the licence', () => {
    for (const b of result.base) {
      const text = result.rangeText[b.id]
      expect(text, b.id).not.toMatch(/\*\*\* (START|END) OF/)
      expect(text, b.id).not.toContain('Project Gutenberg License')
      expect(text, b.id).not.toContain('FULL PROJECT GUTENBERG')
    }
  })

  it('has the new genres in the allowed list', () => {
    for (const g of [
      'politics',
      'history',
      'memoir',
      'spirituality',
      'self-help',
      'science',
      'war',
      'fantasy',
    ]) {
      expect(GENRES).toContain(g)
    }
  })
})

describe('EPUB 2 books (no nav document, an NCX contents list)', () => {
  const entry = (id: string): BaseEntry => {
    const found = result.base.find((b) => b.id === id)
    if (!found) throw new Error('no such row: ' + id)
    return found
  }

  it('reads Miss Brill from pg-1429: it starts at its title and stops at its end', () => {
    const miss = entry('pg-1429-miss-brill')
    expect(miss.isCollection).toBe(true)
    expect(miss.bookTitle).toBe('The Garden Party, and Other Stories')
    expect(miss.startHref).toMatch(/_1429-h-9\.htm\.html#pgepubid00036$/)
    expect(miss.endHref).toMatch(/_1429-h-10\.htm\.html#pgepubid00037$/)
    const text = result.rangeText[miss.id].replace(/\s+/g, ' ').trim()
    expect(text.startsWith('Miss Brill')).toBe(true)
    expect(text).toContain('Although it was so brilliantly fine')
    expect(text.endsWith('she heard something crying.')).toBe(true)
    // It stops before the next story, Her First Ball, and does not start in the one before it.
    expect(text).not.toContain('Her First Ball')
    expect(text).not.toContain('Marriage')
    expect(miss.wordCount).toBe(1949)
  })

  it('finds the licence of an EPUB 2 whole book from the Gutenberg footer heading', () => {
    const prophet = entry('pg-58585-the-prophet')
    expect(prophet.isCollection).toBe(false)
    // Starts at the title of the poem itself, past the copyright page and list of books.
    expect(prophet.startHref).toMatch(/#pgepubid00005$/)
    expect(prophet.endHref).toMatch(/#pg-footer-heading$/)
    expect(result.rangeText[prophet.id]).not.toContain('Project Gutenberg')
    expect(prophet.wordCount).toBe(12336)
  })

  it('gives each EPUB 2 story the right word count from the inventory', () => {
    const expected: Record<string, number> = {
      'pg-1429-bank-holiday': 1242,
      'pg-11870-the-red-room': 3625,
      'pg-12758-the-necklace': 2895,
      'pg-1732-misery': 2148,
      'pg-13437-the-bet': 2719,
      'pg-56870-twenty-six-of-us-and-one-other': 5970,
    }
    for (const [id, words] of Object.entries(expected)) {
      expect(entry(id).wordCount, id).toBe(words)
    }
  })

  it('keeps a story whole when its contents list splits the title from an epigraph or a part number', () => {
    // Misery has a second contents entry for its epigraph; The Bet has a "II" part.
    expect(result.rangeText['pg-1732-misery']).toContain(
      'To whom shall I tell my grief?',
    )
    expect(result.rangeText['pg-13437-the-bet']).toMatch(/\bII\b/)
  })

  it('reads the EPUB 3 books exactly as before', () => {
    const tell = entry('pg-2148-the-tell-tale-heart')
    expect(tell.wordCount).toBe(2104)
    expect(tell.startHref).toMatch(/\.htm\.xhtml#/)
  })
})

describe('story_author', () => {
  const find = (id: string): BaseEntry => result.base.find((b) => b.id === id)!

  it('uses story_author when sources.csv gives one', () => {
    expect(find('pg-13437-the-bet').author).toBe('Anton Pavlovich Chekhov')
    expect(find('pg-12732-the-piece-of-string').author).toBe(
      'Guy de Maupassant',
    )
    expect(find('pg-12758-the-necklace').author).toBe('Guy de Maupassant')
    expect(find('pg-61-the-communist-manifesto').author).toBe(
      'Karl Marx and Friedrich Engels',
    )
    expect(find('pg-2680-the-second-book').author).toBe('Marcus Aurelius')
  })

  it('otherwise uses the author in the EPUB', () => {
    expect(find('pg-1429-miss-brill').author).toBe('Katherine Mansfield')
    expect(find('pg-2814-eveline').author).toBe('James Joyce')
    expect(find('pg-35-the-time-machine').author).toBe('H. G. Wells')
  })
})

describe('catalog entries', () => {
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
      if (expected === undefined) continue
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
  'pg-61-the-communist-manifesto',
  'pg-132-chapter-i-laying-plans',
  'pg-132-chapter-iii-attack-by-stratagem',
  'pg-132-chapter-vi-weak-points-and-strong',
  'pg-147-of-the-origin-and-design-of-government-in-general-with-concise-remarks-on-the-english-constitution',
  'pg-147-thoughts-on-the-present-state-of-american-affairs',
  'pg-205-where-i-lived-and-what-i-lived-for',
  'pg-205-reading',
  'pg-205-solitude',
  'pg-216-the-tao-teh-king',
  'pg-368-acres-of-diamonds',
  'pg-408-i-of-our-spiritual-strivings',
  'pg-408-xi-of-the-passing-of-the-first-born',
  'pg-408-xiv-of-the-sorrow-songs',
  'pg-1232-chapter-xvii-concerning-cruelty-and-clemency-and-whether-it-is-better-to-be-loved-than-feared',
  'pg-1232-chapter-xviii-concerning-the-way-in-which-princes-should-keep-faith',
  'pg-1232-chapter-xxv-what-fortune-can-effect-in-human-affairs-and-how-to-withstand-her',
  'pg-1656-apology',
  'pg-2376-chapter-i-a-slave-among-slaves',
  'pg-2376-chapter-xiv-the-atlanta-exposition-address',
  'pg-2680-the-second-book',
  'pg-2680-the-fourth-book',
  'pg-2680-the-sixth-book',
  'pg-4507-as-a-man-thinketh',
  'pg-5827-chapter-i-appearance-and-reality',
  'pg-5827-chapter-xv-the-value-of-philosophy',
  'pg-11224-chapter-ii-what-utilitarianism-is',
  'pg-34901-chapter-ii-of-the-liberty-of-thought-and-discussion',
  'pg-58585-the-prophet',
  'pg-71-on-the-duty-of-civil-disobedience',
  'pg-1080-a-modest-proposal',
  'pg-2944-compensation',
  'pg-3172-fenimore-coopers-literary-offences',
  'pg-16643-self-reliance',
])

const CURATION_KEYS = [
  'year',
  'yearBasis',
  'eraBand',
  'form',
  'genres',
  'moods',
  'contentNotes',
  'hook',
  'blurb',
  'generatedBy',
  'reviewed',
  'review',
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
      expect(e.year, e.id).toBeGreaterThan(
        e.yearBasis === 'composition-approx' ? -1000 : 1500,
      )
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

  it('gives every AI-written record a year basis', () => {
    for (const e of result.entries) {
      if (e.review === 'auto') {
        expect(YEAR_BASES, e.id).toContain(e.yearBasis)
      } else if (e.yearBasis !== undefined) {
        expect(YEAR_BASES, e.id).toContain(e.yearBasis)
      }
    }
  })

  it('tags "Of the Coming of John" as a story, though it sits in a book of essays', () => {
    const find = (id: string): CatalogEntry | undefined =>
      result.entries.find((e) => e.id === id)
    expect(find('pg-408-xiii-of-the-coming-of-john')?.form).toBe('story')
    expect(find('pg-408-xiii-of-the-coming-of-john')?.genres).toEqual([
      'literary',
    ])
    expect(find('pg-408-i-of-our-spiritual-strivings')?.form).toBe('essay')
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

  it('never copies six or more words in a row from the story into a hook or blurb (every curation record, shipped or not)', () => {
    const words = (s: string): string[] =>
      (
        s.match(
          /[A-Za-z0-9\u00C0-\uFFFF]+(?:['\u2019-][A-Za-z0-9\u00C0-\uFFFF]+)*/g,
        ) ?? []
      ).map((w) => w.toLowerCase().replace(/\u2019/g, "'"))
    // Every record in curation.json, including the ones held back with reviewed: false.
    const records = mergeCuration(result.base, loadCuration())
    expect(records.length).toBeGreaterThanOrEqual(result.entries.length)
    for (const e of records) {
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

  it('leaves out an entry that has no curation record (it is not ready to ship)', () => {
    const { base } = sample()
    expect(mergeCuration([base], { schemaVersion: 1, entries: {} })).toEqual([])
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

  it('gives every entry a grade and band that agree, unless the band was set by hand', () => {
    for (const e of result.entries) {
      expect(e.readingLevel.grade, e.id).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(e.readingLevel.grade), e.id).toBe(true)
      const computed = readingLevelFor(result.rangeText[e.id])
      expect(e.readingLevel.grade, e.id).toBe(computed.grade)
      if (e.readingLevel.adjusted) {
        expect(e.readingLevel.band, e.id).not.toBe(computed.band)
      } else {
        expect(e.readingLevel, e.id).toEqual(computed)
        expect(e.readingLevel.band, e.id).toBe(
          readingBandFor(e.readingLevel.grade),
        )
      }
    }
  })
})

describe('the build cache key', () => {
  it('is a stable hash of content/ and the script, so unchanged inputs skip the build', async () => {
    const { inputHash } = await import('./build-catalog.ts')
    const first = inputHash()
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(inputHash()).toBe(first)
  })
})

describe('cutting a story at some text', () => {
  it('keeps the text and what follows with startAtText, and drops the text and what follows with endBeforeText', () => {
    const story =
      'Notes.\nChapter one. It begins.\nIt ends.\nPrinted by\n Morrison & Gibb'
    expect(cutAtText(story, 'It begins', 'from', 'x')).toBe(
      'It begins.\nIt ends.\nPrinted by\n Morrison & Gibb',
    )
    expect(cutAtText(story, 'Printed by Morrison & Gibb', 'before', 'x')).toBe(
      'Notes.\nChapter one. It begins.\nIt ends.\n',
    )
  })

  it('stops the build when the text is missing or appears twice', () => {
    expect(() => cutAtText('one two', 'three', 'before', 'row 2')).toThrow(
      /was not found/,
    )
    expect(() => cutAtText('go go', 'go', 'before', 'row 2')).toThrow(
      /appears 2 times/,
    )
  })

  it('ends Lad: A Dog before the transcriber’s list of corrections', () => {
    const lad = result.base.find((b) => b.id === 'pg-38777-lad-a-dog')!
    expect(lad.endBeforeText).toBe(
      'The following is a list of changes made to the original.',
    )
    const text = result.rangeText[lad.id]
    expect(text).not.toContain('list of changes made')
    expect(text).not.toContain('Nineteenth Printing')
    expect(text.trimEnd().endsWith('Pompton Lakes,\n New Jersey.')).toBe(true)
  })

  it('ends The Mouse before the printer’s line', () => {
    const mouse = result.base.find((b) => b.id === 'pg-1870-the-mouse')!
    expect(mouse.endBeforeText).toBe('Printed by Morrison & Gibb')
    const text = result.rangeText[mouse.id]
    expect(text).not.toContain('Morrison')
    expect(text.trimEnd().endsWith('at a railway station.”')).toBe(true)
  })
})

describe('Raggylug', () => {
  it('ends before the next story’s half-title and rhyme', () => {
    const rag = result.base.find((b) => b.id.startsWith('pg-3031-raggylug'))!
    expect(rag.endBeforeText).toBe('BINGO')
    const text = result.rangeText[rag.id]
    expect(text).not.toContain('Franckelyn')
    expect(text).toContain('know just how and when to thump it.')
  })
})

describe('Wild Animals I Have Known ranges', () => {
  const names = [
    'LOBO',
    'SILVERSPOT',
    'RAGGYLUG',
    'BINGO',
    'SPRINGFIELD FOX',
    'PACING MUSTANG',
    'WULLY',
    'REDRUFF',
  ]

  it('has all eight stories', () => {
    const ids = result.base.filter((b) => b.id.startsWith('pg-3031-'))
    expect(ids).toHaveLength(8)
  })

  it('no story ends with the next story’s half-title or rhyme', () => {
    for (const story of result.base.filter((b) =>
      b.id.startsWith('pg-3031-'),
    )) {
      const text = result.rangeText[story.id]
      const tail = text.slice(-300)
      if (!story.id.includes('bingo')) {
        expect(text, story.id).not.toContain('Franckelyn')
      }
      for (const name of names) {
        const own = story.id.toUpperCase().includes(name.replace(' ', '-'))
        if (own) continue
        expect(tail, story.id + ' ends with ' + name).not.toContain(name)
      }
    }
  })
})

describe('illustration placeholders and front matter', () => {
  it('strips placeholder lines and inline placeholders, and nothing else', () => {
    const text =
      'One.\n{Illustration}\nTwo.\n[Illustration: A boy] {Illustration}\nThree {Illustration: tree} four.\n'
    expect(stripIllustrationPlaceholders(text)).toBe(
      'One.\nTwo.\nThree four.\n',
    )
    expect(stripIllustrationPlaceholders('A [note] in {braces}.')).toBe(
      'A [note] in {braces}.',
    )
  })

  it('leaves no placeholder in any shipped text', () => {
    for (const text of Object.values(result.rangeText)) {
      expect(text).not.toMatch(/[{[]\s*Illustration/i)
    }
  })

  it('opens Beautiful Joe, Peter Rabbit and A Dog’s Tale at the story itself', () => {
    const starts: Record<string, string> = {
      'pg-2818-beautiful-joe': 'MY name is Beautiful Joe',
      'pg-14838-the-tale-of-peter-rabbit': 'Once upon a time',
      'pg-3174-a-dogs-tale': 'My father was a St. Bernard',
    }
    for (const [id, start] of Object.entries(starts)) {
      expect(result.rangeText[id].trimStart().startsWith(start), id).toBe(true)
    }
  })
})
