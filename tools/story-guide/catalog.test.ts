import {
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CATALOG_MAX_AGE_MS,
  CatalogUnavailable,
  buildIndex,
  displayAuthor,
  editDistance,
  loadCatalog,
  parseCsv,
  resetCatalogMemory,
  searchIndex,
} from './catalog.ts'
import { GUTENDEX, findBook, searchGutenberg } from './gutenberg.ts'

const CSV = [
  'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves',
  '1342,Text,1998-06-01,Pride and Prejudice,en,"Austen, Jane, 1775-1817",x,PR,y',
  '2147,Text,1998-06-01,"The Works of Edgar Allan Poe — Volume 1",en,"Poe, Edgar Allan, 1809-1849",x,PS,y',
  '23172,Text,2007-10-24,"The Damned Thing\n1898, From ""In the Midst of Life""",en,"Bierce, Ambrose, 1842-1914?",x,PS,y',
  '2148,Text,1998-06-01,The Tell-Tale Heart,en,"Poe, Edgar Allan, 1809-1849",x,PS,y',
  '8000,Text,2001-01-01,Les Misérables,fr,"Hugo, Victor, 1802-1885",x,PQ,y',
  '8001,Sound,2001-01-01,The Raven (audio),en,"Poe, Edgar Allan, 1809-1849",x,PS,y',
  '8002,Text,2001-01-01,Bilingual Reader,en; fr,"Nobody, N.",x,PQ,y',
  '1065,Text,1998-01-01,The Raven,en,"Poe, Edgar Allan, 1809-1849",x,PS,y',
].join('\n')

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes and line breaks inside quotes', () => {
    const table = parseCsv(CSV)
    expect(table).toHaveLength(9)
    expect(table[3][3]).toBe(
      'The Damned Thing\n1898, From "In the Midst of Life"',
    )
    expect(table[1][5]).toBe('Austen, Jane, 1775-1817')
  })
})

describe('buildIndex', () => {
  const index = buildIndex(CSV)

  it('keeps only English texts (not audio, not other languages, not mixed)', () => {
    expect(index.rows.map((r) => r.id)).toEqual([1342, 2147, 23172, 2148, 1065])
  })

  it('shows the first line of the title and the author as "First Last"', () => {
    expect(index.byId.get(23172)).toMatchObject({
      title: 'The Damned Thing',
      author: 'Ambrose Bierce',
    })
    expect(displayAuthor('Poe, Edgar Allan, 1809-1849')).toBe('Edgar Allan Poe')
    expect(
      displayAuthor('Hamilton, Alexander, 1757-1804; Jay, John, 1745-1829'),
    ).toBe('Alexander Hamilton')
    expect(
      displayAuthor('Longfellow, Henry Wadsworth, 1807-1882; Morris [Editor]'),
    ).toBe('Henry Wadsworth Longfellow')
    expect(displayAuthor('United States')).toBe('United States')
  })
})

describe('searchIndex', () => {
  const index = buildIndex(CSV)
  const ids = (q: string) => searchIndex(index, q).map((h) => h.id)

  it('finds by title, ignoring case', () => {
    expect(ids('PRIDE and prejudice')[0]).toBe(1342)
  })

  it('finds by author', () => {
    expect(ids('austen')).toEqual([1342])
    expect(ids('poe')).toEqual(expect.arrayContaining([2147, 2148, 1065]))
  })

  it('forgives small misspellings: "edgar allen" finds Edgar Allan Poe', () => {
    const found = ids('edgar allen')
    expect(found).toEqual(expect.arrayContaining([2147, 2148, 1065]))
    expect(found).not.toContain(1342)
  })

  it('ranks a name matched inside the author above words scattered across title and author', () => {
    const csv = [
      'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves',
      // "Edgar" is the author and "Allen" is a different person, the illustrator.
      '1,Text,2000-01-01,Tales of Mars,en,"Burroughs, Edgar Rice, 1875-1950; Allen, J. [Illustrator]",x,x,y',
      '2,Text,2000-01-01,The Raven and Other Poems,en,"Poe, Edgar Allan, 1809-1849",x,x,y',
    ].join('\n')
    expect(
      searchIndex(buildIndex(csv), 'edgar allen').map((h) => h.id),
    ).toEqual([2, 1])
  })

  it('forgives a typo in a title word, and a swapped pair of letters', () => {
    expect(ids('pride and prejudise')[0]).toBe(1342)
    expect(ids('the damned tihng')[0]).toBe(23172)
  })

  it('finds a title from a subtitle line, and ignores accents', () => {
    expect(ids('in the midst of life')[0]).toBe(23172)
    expect(
      searchIndex(
        buildIndex(CSV.replace('Pride and Prejudice', 'Café Society')),
        'cafe',
      )[0].id,
    ).toBe(1342)
  })

  it('puts the exact title first and returns nothing for nonsense', () => {
    expect(ids('the raven')[0]).toBe(1065)
    expect(ids('zzzzqqqq')).toEqual([])
    expect(ids('   ')).toEqual([])
  })

  it('returns at most 10', () => {
    const many = [
      'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves',
    ]
    for (let i = 1; i <= 40; i++)
      many.push(`${i},Text,2000-01-01,Tale number ${i},en,"Poe, E.",x,x,y`)
    expect(searchIndex(buildIndex(many.join('\n')), 'tale')).toHaveLength(10)
  })
})

describe('editDistance', () => {
  it('counts a swap of neighbouring letters as one slip, and gives up past the limit', () => {
    expect(editDistance('allan', 'allen', 2)).toBe(1)
    expect(editDistance('allna', 'allan', 2)).toBe(1)
    expect(editDistance('allan', 'alexander', 2)).toBe(3)
  })
})

describe('loadCatalog', () => {
  let dir: URL
  beforeEach(async () => {
    resetCatalogMemory()
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-cat-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  const file = () => new URL('pg_catalog.csv', dir)
  const ok = () => vi.fn(async () => new Response(CSV))

  it('downloads the file once and then uses the copy', async () => {
    const fetchFn = ok()
    const first = await loadCatalog(fetchFn as typeof fetch, dir)
    expect(first.rows).toHaveLength(5)
    expect(await readFile(file(), 'utf8')).toBe(CSV)
    resetCatalogMemory()
    await loadCatalog(fetchFn as typeof fetch, dir)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(
      /DogEaredTales/,
    )
  })

  it('refreshes only when the copy is older than 7 days', async () => {
    await writeFile(file(), CSV)
    const fetchFn = ok()
    const mtime = (await stat(file())).mtimeMs
    await loadCatalog(
      fetchFn as typeof fetch,
      dir,
      () => mtime + CATALOG_MAX_AGE_MS - 1000,
    )
    expect(fetchFn).not.toHaveBeenCalled()
    resetCatalogMemory()
    await loadCatalog(
      fetchFn as typeof fetch,
      dir,
      () => mtime + CATALOG_MAX_AGE_MS + 1000,
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('uses an older copy when the refresh fails', async () => {
    await writeFile(file(), CSV)
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    await utimes(file(), old, old)
    const down = vi.fn(async () => new Response('', { status: 503 }))
    const index = await loadCatalog(down as typeof fetch, dir)
    expect(index.rows).toHaveLength(5)
    expect(down).toHaveBeenCalledTimes(1)
  })

  it('says the catalog is unavailable when there is no copy and no download', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(loadCatalog(down as typeof fetch, dir)).rejects.toBeInstanceOf(
      CatalogUnavailable,
    )
  })

  it('does not keep a download that is not the catalog', async () => {
    const wrong = vi.fn(async () => new Response('<html>nope</html>'))
    await expect(
      loadCatalog(wrong as typeof fetch, dir),
    ).rejects.toBeInstanceOf(CatalogUnavailable)
    await expect(stat(file())).rejects.toThrow()
  })
})

describe('searchGutenberg and findBook', () => {
  let dir: URL
  beforeEach(async () => {
    resetCatalogMemory()
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-find-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  const index = buildIndex(CSV)
  const unavailable = async () => {
    throw new CatalogUnavailable('no file')
  }

  it('searches the local catalog and never calls Gutendex when it has the file', async () => {
    const fetchFn = vi.fn()
    const found = await searchGutenberg(
      'edgar allen',
      fetchFn as unknown as typeof fetch,
      async () => index,
    )
    expect(found.map((f) => f.id)).toEqual(expect.arrayContaining([2147, 2148]))
    expect(found[0]).toMatchObject({ author: 'Edgar Allan Poe', downloads: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('falls back to Gutendex (15 s timeout, /books/ with its slash) when there is no catalog file', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: 5,
                title: 'Fallback Book',
                authors: [{ name: 'Saki' }],
                download_count: 3,
                formats: {},
              },
            ],
          }),
        ),
    )
    const found = await searchGutenberg(
      'x',
      fetchFn as typeof fetch,
      unavailable,
    )
    expect(found[0].title).toBe('Fallback Book')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(GUTENDEX.endsWith('/books/')).toBe(true)
    expect(url.startsWith('https://gutendex.com/books/?')).toBe(true)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('says so clearly when the catalog and Gutendex both fail', async () => {
    const down = vi.fn(async () => new Response('', { status: 503 }))
    await expect(
      searchGutenberg('x', down as typeof fetch, unavailable),
    ).rejects.toThrow(
      /catalog file, and the Gutendex fallback is not answering/,
    )
  })

  it("finds a book from the catalog with Gutenberg's standard text link, without Gutendex", async () => {
    const fetchFn = vi.fn()
    const book = await findBook(
      23172,
      fetchFn as unknown as typeof fetch,
      dir,
      async () => index,
    )
    expect(book).toMatchObject({
      id: 23172,
      title: 'The Damned Thing',
      author: 'Ambrose Bierce',
      textUrl: 'https://www.gutenberg.org/cache/epub/23172/pg23172.txt',
    })
    expect(fetchFn).not.toHaveBeenCalled()
    // Remembered: a second look needs no catalog at all.
    const again = await findBook(
      23172,
      fetchFn as unknown as typeof fetch,
      dir,
      unavailable,
    )
    expect(again).toEqual(book)
  })

  it('asks Gutendex (with the trailing slash) only for a book that is not in the catalog', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 9,
            title: 'Odd One',
            authors: [{ name: 'Nobody, N.' }],
            formats: {
              'text/plain; charset=utf-8': 'https://www.gutenberg.org/x.txt',
            },
          }),
        ),
    )
    const book = await findBook(
      9,
      fetchFn as typeof fetch,
      dir,
      async () => index,
    )
    expect(book.title).toBe('Odd One')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://gutendex.com/books/9/',
    )
  })
})
