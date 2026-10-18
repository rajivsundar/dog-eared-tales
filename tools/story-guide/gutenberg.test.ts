import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GutenbergError,
  USER_AGENT,
  capWords,
  findBook,
  loadBookText,
  pickTextUrl,
  readableAuthor,
  searchGutendex,
  trimGutenbergText,
} from './gutenberg.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

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

describe('Gutendex results', () => {
  it('prefers the UTF-8 plain text and skips zips and web pages', () => {
    expect(
      pickTextUrl({
        'text/html': 'https://www.gutenberg.org/ebooks/1.html.images',
        'text/plain; charset=us-ascii': 'https://www.gutenberg.org/a.txt',
        'text/plain; charset=utf-8': 'https://www.gutenberg.org/u.txt',
        'application/zip': 'https://www.gutenberg.org/z.zip',
      }),
    ).toBe('https://www.gutenberg.org/u.txt')
    expect(pickTextUrl({ 'text/html': 'x' })).toBeNull()
  })

  it('turns "Last, First" into "First Last"', () => {
    expect(readableAuthor('Poe, Edgar Allan')).toBe('Edgar Allan Poe')
    expect(readableAuthor('Anonymous')).toBe('Anonymous')
  })
})

describe('searchGutendex', () => {
  it('asks for English, public-domain books, sends a User-Agent, and returns the top 10', async () => {
    const results = Array.from({ length: 14 }, (_, i) => ({
      id: i + 1,
      title: `Book ${i + 1}`,
      authors: [{ name: 'Saki' }],
      download_count: 100 - i,
      formats: {},
    }))
    const fetchFn = vi.fn(async () => json({ results }))
    const found = await searchGutendex('open window', fetchFn as typeof fetch)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toContain('search=open+window')
    expect(url).toContain('languages=en')
    expect(url).toContain('copyright=false')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      USER_AGENT,
    )
    expect(found).toHaveLength(10)
    expect(found[0]).toEqual({
      id: 1,
      title: 'Book 1',
      author: 'Saki',
      downloads: 100,
    })
  })

  it('says clearly that Gutendex is down, for an error status or no answer', async () => {
    for (const fetchFn of [
      async () => json({}, 503),
      async () => {
        throw new TypeError('fetch failed')
      },
    ]) {
      const failure = searchGutendex('x', fetchFn as typeof fetch)
      await expect(failure).rejects.toBeInstanceOf(GutenbergError)
      await expect(failure).rejects.toThrow(/not answering right now/)
    }
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
    downloads: 1,
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

  it('remembers a book picked earlier, so it works while Gutendex is down', async () => {
    const up = vi.fn(async () =>
      json({
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Shelley, Mary' }],
        download_count: 5,
        formats: { 'text/plain; charset=utf-8': book.textUrl },
      }),
    )
    const first = await findBook(84, up as typeof fetch, dir)
    expect(first.author).toBe('Mary Shelley')
    const down = vi.fn(async () => json({}, 503))
    expect(await findBook(84, down as typeof fetch, dir)).toEqual(first)
    expect(down).not.toHaveBeenCalled()
  })
})
