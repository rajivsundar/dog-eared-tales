// Story Guide: Project Gutenberg search. All fetching happens here, on the server; the browser
// never calls Gutendex or Gutenberg. A build-time tool: it never ships in the app.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { stripIllustrationPlaceholders } from '../../scripts/build-catalog.ts'
import {
  CatalogUnavailable,
  type CatalogIndex,
  loadCatalog,
  searchIndex,
} from './catalog.ts'
import { GutenbergError, USER_AGENT, type Fetch } from './common.ts'

export { GutenbergError, USER_AGENT }

// Gutendex is only a fallback now: the local catalog file is searched first.
export const GUTENDEX = 'https://gutendex.com/books/'
/** The most words the full-story call reads. */
export const MAX_ANALYSED_WORDS = 20_000
export const MAX_RESULTS = 10

export interface GutenbergResult {
  id: number
  title: string
  author: string
  downloads: number
}

export interface GutenbergBook extends GutenbergResult {
  /** The plain-text file Gutendex gave for this book. */
  textUrl: string
}

/** "Poe, Edgar Allan" becomes "Edgar Allan Poe". */
export function readableAuthor(name: string): string {
  const [last, first] = name.split(/,\s*/, 2)
  return first ? `${first} ${last}` : name
}

interface RawBook {
  id?: unknown
  title?: unknown
  authors?: { name?: unknown }[]
  download_count?: unknown
  formats?: Record<string, unknown>
}

/** The plain-text (UTF-8 if there is one) link in a Gutendex book's formats. */
export function pickTextUrl(
  formats: Record<string, unknown> | undefined,
): string | null {
  const plain = Object.entries(formats ?? {}).filter(
    ([type, url]) =>
      type.startsWith('text/plain') &&
      typeof url === 'string' &&
      !url.endsWith('.zip'),
  ) as [string, string][]
  const utf8 = plain.find(([type]) => /utf-?8/i.test(type))
  return (utf8 ?? plain[0])?.[1] ?? null
}

export function toBook(raw: RawBook): GutenbergBook | null {
  if (typeof raw.id !== 'number' || typeof raw.title !== 'string') return null
  const name = raw.authors?.[0]?.name
  return {
    id: raw.id,
    title: raw.title.replace(/\s+/g, ' ').trim(),
    author: typeof name === 'string' ? readableAuthor(name) : 'Unknown author',
    downloads: typeof raw.download_count === 'number' ? raw.download_count : 0,
    textUrl: pickTextUrl(raw.formats) ?? '',
  }
}

const DOWN =
  'Project Gutenberg search (Gutendex) is not answering right now. Try again in a minute, or pick a catalog story or paste text instead.'

async function getJson(url: string, fetchFn: Fetch): Promise<unknown> {
  let response: Response
  try {
    response = await fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new GutenbergError(DOWN)
  }
  if (response.status === 404) throw new GutenbergError('No such book.')
  if (!response.ok) throw new GutenbergError(DOWN)
  try {
    return await response.json()
  } catch {
    throw new GutenbergError(DOWN)
  }
}

/** The top 10 English, public-domain results for a search. */
export async function searchGutendex(
  query: string,
  fetchFn: Fetch = fetch,
): Promise<GutenbergResult[]> {
  const url = `${GUTENDEX}?${new URLSearchParams({
    search: query,
    languages: 'en',
    copyright: 'false',
  })}`
  const body = (await getJson(url, fetchFn)) as { results?: RawBook[] }
  const books = (body.results ?? []).map(toBook).filter((b) => b !== null)
  return books.slice(0, MAX_RESULTS).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    downloads: b.downloads,
  }))
}

const CACHE = new URL('./cache/', import.meta.url)

/** Where Project Gutenberg keeps a book's UTF-8 plain text. */
export const gutenbergTextUrl = (id: number): string =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`

/**
 * Searches Project Gutenberg's official catalog file on this computer (title and author, English
 * only, forgiving of small misspellings). Only if that file cannot be downloaded and there is no
 * copy is Gutendex tried instead.
 */
export async function searchGutenberg(
  query: string,
  fetchFn: Fetch = fetch,
  catalog: () => Promise<CatalogIndex> = () => loadCatalog(fetchFn),
): Promise<GutenbergResult[]> {
  try {
    return searchIndex(await catalog(), query, MAX_RESULTS).map((hit) => ({
      ...hit,
      downloads: 0,
    }))
  } catch (error) {
    if (!(error instanceof CatalogUnavailable)) throw error
    console.error(
      `story-guide: the Gutenberg catalog file is not available (${error.message}); trying Gutendex`,
    )
  }
  try {
    return await searchGutendex(query, fetchFn)
  } catch {
    throw new GutenbergError(
      "Could not get Project Gutenberg's catalog file, and the Gutendex fallback is not answering either. Check your internet connection and try again in a minute, or pick a catalog story or paste text instead.",
    )
  }
}

/**
 * One book by its Gutenberg id. The client only ever sends the id, never a link. The details come
 * from the local catalog file (the text link is Gutenberg's standard one); only for a book not in
 * it, or with no catalog file, is Gutendex asked. Kept in cache/<id>.json, so a book already
 * picked needs neither.
 */
export async function findBook(
  id: number,
  fetchFn: Fetch = fetch,
  cacheDir: URL = CACHE,
  catalog: () => Promise<CatalogIndex> = () => loadCatalog(fetchFn),
): Promise<GutenbergBook> {
  const file = new URL(`${id}.json`, cacheDir)
  try {
    const cached = toBook(
      JSON.parse(await readFile(file, 'utf8')) as RawBook & {
        textUrl?: string
      },
    )
    if (cached) return cached
  } catch {
    // Not cached yet.
  }

  let book: GutenbergBook | null = null
  try {
    const row = (await catalog()).byId.get(id)
    if (row)
      book = {
        id,
        title: row.title,
        author: row.author,
        downloads: 0,
        textUrl: gutenbergTextUrl(id),
      }
  } catch (error) {
    if (!(error instanceof CatalogUnavailable)) throw error
  }
  if (!book) {
    const raw = (await getJson(`${GUTENDEX}${id}/`, fetchFn)) as RawBook
    book = toBook(raw)
    if (!book)
      throw new GutenbergError('Gutendex sent back something unexpected.')
    if (!book.textUrl)
      throw new GutenbergError('This book has no plain-text file on Gutenberg.')
  }
  await mkdir(cacheDir, { recursive: true })
  await writeFile(
    file,
    JSON.stringify({
      id: book.id,
      title: book.title,
      authors: [{ name: book.author }],
      download_count: book.downloads,
      formats: { 'text/plain; charset=utf-8': book.textUrl },
    }),
    'utf8',
  )
  return book
}

/**
 * Cuts Project Gutenberg's header and footer, with the same trims the catalog build uses: the
 * START and END lines, the licence tail, a transcriber's note near the end, and illustration
 * placeholders.
 */
export function trimGutenbergText(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n')
  const header = /\*\*\* START OF [^\n]*?\*\*\*/.exec(text)
  if (header) text = text.slice(header.index + header[0].length)
  const footer = /\*\*\* END OF [^\n]*?\*\*\*/.exec(text)
  if (footer) text = text.slice(0, footer.index)
  const tail = /\n\s*End of (?:the )?Project Gutenberg/i.exec(text)
  if (tail) text = text.slice(0, tail.index)
  const notes = /\n\s*Transcriber['’]s Notes?\s*\n/i.exec(text)
  if (notes && notes.index > text.length * 0.8)
    text = text.slice(0, notes.index)
  return stripIllustrationPlaceholders(text).trim()
}

/** At most `max` words of a text, cut after a whole word. */
export function capWords(
  text: string,
  max: number,
): {
  text: string
  analysedWords: number
  totalWords: number
  truncated: boolean
} {
  let count = 0
  let end = text.length
  for (const match of text.matchAll(/\S+/g)) {
    count++
    if (count === max) end = match.index + match[0].length
  }
  const truncated = count > max
  return {
    text: truncated ? text.slice(0, end) : text,
    analysedWords: Math.min(count, max),
    totalWords: count,
    truncated,
  }
}

/**
 * A book's raw text, downloaded once and kept in tools/story-guide/cache/<id>.txt. Only a link
 * on gutenberg.org that Gutendex gave is ever fetched.
 */
export async function loadBookText(
  book: GutenbergBook,
  fetchFn: Fetch = fetch,
  cacheDir: URL = CACHE,
): Promise<string> {
  const file = new URL(`${book.id}.txt`, cacheDir)
  try {
    return await readFile(file, 'utf8')
  } catch {
    // Not cached yet.
  }
  const host = new URL(book.textUrl).hostname
  if (host !== 'gutenberg.org' && !host.endsWith('.gutenberg.org'))
    throw new GutenbergError(
      'Gutendex sent a text link that is not on gutenberg.org.',
    )
  let response: Response
  try {
    response = await fetchFn(book.textUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new GutenbergError(
      'Could not download the book from Project Gutenberg. Try again in a minute.',
    )
  }
  if (!response.ok)
    throw new GutenbergError(
      `Project Gutenberg answered ${response.status} for this book. Try again in a minute.`,
    )
  const text = await response.text()
  await mkdir(cacheDir, { recursive: true })
  await writeFile(file, text, 'utf8')
  return text
}

export const gutenbergPage = (id: number): string =>
  `https://www.gutenberg.org/ebooks/${id}`
