import { describe, expect, it } from 'vitest'
import {
  WORDS_PER_MINUTE,
  lengthLabel,
  matchesLength,
  minutesFor,
} from './common.ts'
import { searchSources, type SearchSources } from './search.ts'
import { GutenbergError } from './gutenberg.ts'
import { WikisourceError, type PageInfo } from './wikisource.ts'

describe('length rules', () => {
  it('Short is under 5,000 words, Medium 5,000 to 20,000, Long over 20,000', () => {
    expect(matchesLength(4999, 'short')).toBe(true)
    expect(matchesLength(5000, 'short')).toBe(false)
    expect(matchesLength(5000, 'medium')).toBe(true)
    expect(matchesLength(20000, 'medium')).toBe(true)
    expect(matchesLength(20001, 'medium')).toBe(false)
    expect(matchesLength(20001, 'long')).toBe(true)
    expect(matchesLength(123, 'any')).toBe(true)
  })

  it('never lets an unknown length through a filter, but shows it under Any', () => {
    expect(matchesLength(undefined, 'any')).toBe(true)
    for (const f of ['short', 'medium', 'long'] as const)
      expect(matchesLength(undefined, f)).toBe(false)
  })

  it('reads at 250 words a minute and says "about N words, N min"', () => {
    expect(WORDS_PER_MINUTE).toBe(250)
    expect(minutesFor(2500)).toBe(10)
    expect(minutesFor(10)).toBe(1)
    expect(lengthLabel(3263)).toBe('about 3,300 words, 13 min')
    expect(lengthLabel(25000)).toBe('about 25,000 words, 100 min')
    expect(lengthLabel(480)).toBe('about 480 words, 2 min')
  })
})

const info = (over: Partial<PageInfo> = {}): PageInfo => ({
  title: 'x',
  kind: 'work',
  author: 'Saki',
  license: { tag: 'PD-US' },
  missing: false,
  ...over,
})

function sources(over: Partial<SearchSources> = {}): SearchSources & {
  asked: { gutenbergLimit?: number; wikisourceLimit?: number }
} {
  const asked: { gutenbergLimit?: number; wikisourceLimit?: number } = {}
  return {
    asked,
    gutenbergSearch: async (_q, limit) => {
      asked.gutenbergLimit = limit
      return [
        { id: 1, title: 'Short Book', author: 'Ann Author' },
        { id: 2, title: 'Medium Book', author: 'Bo Author' },
        { id: 3, title: 'Long Book', author: 'Cy Author' },
        { id: 4, title: 'Unmeasured Book', author: 'Di Author' },
      ]
    },
    gutenbergWords: async () =>
      new Map<number, number | undefined>([
        [1, 3000],
        [2, 12000],
        [3, 80000],
        [4, undefined],
      ]),
    wikisourceSearch: async (_q, limit) => {
      asked.wikisourceLimit = limit
      return [
        { title: 'Beasts/The Mouse', words: 1500 },
        { title: 'Modern Story', words: 2000 },
        { title: 'The Open Window', words: 50 },
        { title: 'Big Epic', words: 90000 },
      ]
    },
    wikisourceDescribe: async () =>
      new Map<string, PageInfo>([
        ['Beasts/The Mouse', info()],
        ['Modern Story', info({ author: 'Somebody', license: null })],
        ['The Open Window', info({ kind: 'editions' })],
        ['Big Epic', info()],
      ]),
    ...over,
  }
}

describe('searchSources', () => {
  it('Project Gutenberg: shows title, author, source and an estimated length', async () => {
    const { results, notes } = await searchSources(
      'x',
      'gutenberg',
      'any',
      sources(),
    )
    expect(notes).toEqual([])
    expect(results[0]).toMatchObject({
      source: 'gutenberg',
      key: '1',
      title: 'Short Book',
      author: 'Ann Author',
      words: 3000,
      length: 'about 3,000 words, 12 min',
    })
    // Under Any, a book whose size could not be learned is still listed, without a length.
    expect(results.map((r) => r.key)).toEqual(['1', '2', '3', '4'])
    expect(results[3].length).toBeUndefined()
  })

  it('applies the length filter, and looks at more matches when filtering', async () => {
    const s = sources()
    const short = await searchSources('x', 'gutenberg', 'short', s)
    expect(short.results.map((r) => r.key)).toEqual(['1'])
    expect(s.asked.gutenbergLimit).toBe(40)
    expect(
      (await searchSources('x', 'gutenberg', 'medium', s)).results.map(
        (r) => r.key,
      ),
    ).toEqual(['2'])
    expect(
      (await searchSources('x', 'gutenberg', 'long', s)).results.map(
        (r) => r.key,
      ),
    ).toEqual(['3'])
    const any = sources()
    await searchSources('x', 'gutenberg', 'any', any)
    expect(any.asked.gutenbergLimit).toBe(10)
  })

  it('Wikisource: greys out a page not marked US public domain, and shows a subpage under its collection', async () => {
    const { results } = await searchSources('x', 'wikisource', 'any', sources())
    expect(results[0]).toMatchObject({
      source: 'wikisource',
      key: 'Beasts/The Mouse',
      title: 'The Mouse (in Beasts)',
      author: 'Saki',
      license: 'PD-US',
    })
    const modern = results.find((r) => r.key === 'Modern Story')
    expect(modern).toMatchObject({
      license: null,
      note: 'Not marked US public domain',
    })
  })

  it('Wikisource: an editions page has no length and says so', async () => {
    const { results } = await searchSources('x', 'wikisource', 'any', sources())
    const editions = results.find((r) => r.key === 'The Open Window')
    expect(editions).toMatchObject({
      kind: 'editions',
      author: 'Several editions',
    })
    expect(editions?.length).toBeUndefined()
  })

  it('Wikisource: filters by the length its API reports', async () => {
    const { results } = await searchSources(
      'x',
      'wikisource',
      'long',
      sources(),
    )
    expect(results.map((r) => r.key)).toEqual(['Big Epic'])
  })

  it('Both: lists the two sources together', async () => {
    const { results } = await searchSources('x', 'both', 'any', sources())
    expect(new Set(results.map((r) => r.source))).toEqual(
      new Set(['gutenberg', 'wikisource']),
    )
  })

  it('Both: one source failing is a note, not an error', async () => {
    const s = sources({
      wikisourceSearch: async () => {
        throw new WikisourceError('Wikisource is not answering right now.')
      },
    })
    const { results, notes } = await searchSources('x', 'both', 'any', s)
    expect(results.every((r) => r.source === 'gutenberg')).toBe(true)
    expect(notes).toEqual([
      'Wikisource: Wikisource is not answering right now.',
    ])
  })

  it('fails with the reason when every chosen source fails', async () => {
    const s = sources({
      gutenbergSearch: async () => {
        throw new GutenbergError('No catalog file.')
      },
    })
    await expect(searchSources('x', 'gutenberg', 'any', s)).rejects.toThrow(
      'No catalog file.',
    )
  })
})
