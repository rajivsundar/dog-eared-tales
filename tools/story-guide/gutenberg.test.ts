import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildIndex, CatalogUnavailable } from './catalog.ts'
import {
  GutenbergError,
  USER_AGENT,
  capWords,
  estimateWords,
  findBook,
  gutenbergTextUrl,
  loadBookText,
  searchGutenberg,
  trimGutenbergText,
  wordsFromBytes,
} from './gutenberg.ts'

describe('trimGutenbergText', () => {
  it('cuts the header, the footer and the licence, and drops illustration placeholders', () => {
    const raw = [
      'The Project Gutenberg eBook of Example',
      '*** START OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***',
      '',
      'Chapter I',
      '[Illustration]',
      'It was a dark night.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***',
      'Licence text that must not be read.',
    ].join('\r\n')
    const text = trimGutenbergText(raw)
    expect(text).toContain('It was a dark night.')
    expect(text).not.toContain('Project Gutenberg')
    expect(text).not.toContain('Licence text')
    expect(text).not.toContain('[Illustration]')
    expect(text.startsWith('Chapter I')).toBe(true)
  })
})

describe('capWords', () => {
  it('leaves a short text alone', () => {
    const r = capWords('one two three', 20_000)
    expect(r).toMatchObject({
      analysedWords: 3,
      totalWords: 3,
      truncated: false,
    })
    expect(r.text).toBe('one two three')
  })

  it('keeps exactly the first N words of a longer text, and says so', () => {
    const text = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ')
    const r = capWords(text, 20)
    expect(r.truncated).toBe(true)
    expect(r.totalWords).toBe(50)
    expect(r.analysedWords).toBe(20)
    expect(r.text.split(/\s+/)).toHaveLength(20)
    expect(r.text.endsWith('w19')).toBe(true)
  })
})

describe('the length estimate', () => {
  let dir: URL
  beforeEach(async () => {
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-len-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('takes the licence text off, then counts about 6 bytes a word', () => {
    // Four real books: file size in bytes, and the words they really have.
    for (const [bytes, words] of [
      [38223, 3263],
      [39645, 3432],
      [35146, 2740],
      [41575, 3760],
    ])
      expect(Math.abs(wordsFromBytes(bytes) - words) / words).toBeLessThan(0.07)
    expect(wordsFromBytes(500)).toBe(0)
  })

  it('asks for the file size with HEAD, never downloads the book, and remembers the answer', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(null, { headers: { 'content-length': '38223' } }),
    )
    const first = await estimateWords(
      [23172, 1080],
      fetchFn as typeof fetch,
      dir,
    )
    expect(first.get(23172)).toBe(wordsFromBytes(38223))
    expect(fetchFn).toHaveBeenCalledTimes(2)
    for (const call of fetchFn.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(call[1].method).toBe('HEAD')
      // The uncompressed size is wanted: a zipped file's size would count far too few words.
      expect(
        (call[1].headers as Record<string, string>)['Accept-Encoding'],
      ).toBe('identity')
      expect((call[1].headers as Record<string, string>)['User-Agent']).toBe(
        USER_AGENT,
      )
    }
    expect(
      (fetchFn.mock.calls as unknown as [string][]).map((c) => c[0]),
    ).toEqual(
      expect.arrayContaining([gutenbergTextUrl(23172), gutenbergTextUrl(1080)]),
    )
    await estimateWords([23172, 1080], fetchFn as typeof fetch, dir)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('gives no estimate when the size is not known', async () => {
    const down = vi.fn(async () => new Response(null, { status: 503 }))
    const sizes = await estimateWords([5], down as typeof fetch, dir)
    expect(sizes.get(5)).toBeUndefined()
  })
})

describe('the cache', () => {
  let dir: URL
  beforeEach(async () => {
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const book = {
    id: 84,
    title: 'Frankenstein',
    author: 'Mary Shelley',
    textUrl: 'https://www.gutenberg.org/cache/epub/84/pg84.txt',
  }

  it('downloads a text once, saves it as <id>.txt, then reads it from the cache', async () => {
    const fetchFn = vi.fn(async () => new Response('Some text.'))
    expect(await loadBookText(book, fetchFn as typeof fetch, dir)).toBe(
      'Some text.',
    )
    expect(await readFile(new URL('84.txt', dir), 'utf8')).toBe('Some text.')
    expect(await loadBookText(book, fetchFn as typeof fetch, dir)).toBe(
      'Some text.',
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      USER_AGENT,
    )
  })

  it('only downloads from gutenberg.org', async () => {
    const fetchFn = vi.fn()
    await expect(
      loadBookText(
        { ...book, id: 85, textUrl: 'https://evil.example/book.txt' },
        fetchFn as unknown as typeof fetch,
        dir,
      ),
    ).rejects.toThrow(/not on gutenberg.org/)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

const CSV = [
  'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves',
  '23172,Text,2007-10-24,"The Damned Thing\n1898",en,"Bierce, Ambrose, 1842-1914?",x,PS,y',
  '2148,Text,1998-06-01,The Tell-Tale Heart,en,"Poe, Edgar Allan, 1809-1849",x,PS,y',
].join('\n')
const index = buildIndex(CSV)
const noCatalog = async () => {
  throw new CatalogUnavailable('no file')
}

describe('searchGutenberg and findBook (no Gutendex)', () => {
  let dir: URL
  beforeEach(async () => {
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-find-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('searches the local catalog and asks the network for nothing', async () => {
    const fetchFn = vi.fn()
    const found = await searchGutenberg(
      'edgar allen',
      10,
      fetchFn as unknown as typeof fetch,
      async () => index,
    )
    expect(found).toEqual([
      { id: 2148, title: 'The Tell-Tale Heart', author: 'Edgar Allan Poe' },
    ])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('says clearly what is wrong when there is no catalog file', async () => {
    await expect(
      searchGutenberg('x', 10, fetch, noCatalog),
    ).rejects.toBeInstanceOf(GutenbergError)
    await expect(searchGutenberg('x', 10, fetch, noCatalog)).rejects.toThrow(
      /catalog file, and there is no saved copy/,
    )
  })

  it("finds a book from the catalog with Gutenberg's standard text link, and remembers it", async () => {
    const fetchFn = vi.fn()
    const book = await findBook(
      23172,
      fetchFn as unknown as typeof fetch,
      dir,
      async () => index,
    )
    expect(book).toEqual({
      id: 23172,
      title: 'The Damned Thing',
      author: 'Ambrose Bierce',
      textUrl: 'https://www.gutenberg.org/cache/epub/23172/pg23172.txt',
    })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(
      await findBook(23172, fetchFn as unknown as typeof fetch, dir, noCatalog),
    ).toEqual(book)
  })

  it('refuses a book that is not in the English catalog', async () => {
    await expect(
      findBook(999999, fetch, dir, async () => index),
    ).rejects.toThrow(/not in the English text catalog/)
  })
})
