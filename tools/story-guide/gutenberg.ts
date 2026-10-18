// Story Guide: Project Gutenberg. Search is local, over the official catalog file (see
// catalog.ts); a book's text is its plain-text file on gutenberg.org. All fetching happens here,
// on the server; the browser never contacts Gutenberg. A build-time tool: it never ships in the
// app.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { stripIllustrationPlaceholders } from '../../scripts/build-catalog.ts'
import {
  CatalogUnavailable,
  type CatalogIndex,
  loadCatalog,
  searchIndex,
} from './catalog.ts'
import {
  GutenbergError,
  MAX_ANALYSED_WORDS,
  MAX_RESULTS,
  USER_AGENT,
  capWords,
  type Fetch,
} from './common.ts'

export { GutenbergError, MAX_ANALYSED_WORDS, USER_AGENT, capWords }

export interface GutenbergResult {
  id: number
  title: string
  author: string
}

export interface GutenbergBook extends GutenbergResult {
  /** The plain-text file for this book. */
  textUrl: string
}

const CACHE = new URL('./cache/', import.meta.url)

/** Where Project Gutenberg keeps a book's UTF-8 plain text. */
export const gutenbergTextUrl = (id: number): string =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`

export const gutenbergPage = (id: number): string =>
  `https://www.gutenberg.org/ebooks/${id}`

const NO_CATALOG =
  "Could not get Project Gutenberg's catalog file, and there is no saved copy yet. Check your internet connection and try again in a minute, or use Wikisource or paste text instead."

/**
 * Searches Project Gutenberg's official catalog file on this computer: English texts, title and
 * author, forgiving small misspellings. Returns the best `limit` matches.
 */
export async function searchGutenberg(
  query: string,
  limit = MAX_RESULTS,
  fetchFn: Fetch = fetch,
  catalog: () => Promise<CatalogIndex> = () => loadCatalog(fetchFn),
): Promise<GutenbergResult[]> {
  try {
    return searchIndex(await catalog(), query, limit)
  } catch (error) {
    if (error instanceof CatalogUnavailable) {
      console.error(
        `story-guide: the Gutenberg catalog is not available (${error.message})`,
      )
      throw new GutenbergError(NO_CATALOG)
    }
    throw error
  }
}

/**
 * One book by its Gutenberg id. The client only ever sends the id, never a link; the details come
 * from the local catalog file and the text link is Gutenberg's standard one. Kept in
 * cache/<id>.json, so a book already picked needs no catalog.
 */
export async function findBook(
  id: number,
  fetchFn: Fetch = fetch,
  cacheDir: URL = CACHE,
  catalog: () => Promise<CatalogIndex> = () => loadCatalog(fetchFn),
): Promise<GutenbergBook> {
  const file = new URL(`${id}.json`, cacheDir)
  try {
    const cached = JSON.parse(
      await readFile(file, 'utf8'),
    ) as Partial<GutenbergBook>
    if (
      cached.id === id &&
      typeof cached.title === 'string' &&
      typeof cached.author === 'string' &&
      typeof cached.textUrl === 'string'
    )
      return cached as GutenbergBook
  } catch {
    // Not cached yet.
  }
  let row
  try {
    row = (await catalog()).byId.get(id)
  } catch (error) {
    if (error instanceof CatalogUnavailable)
      throw new GutenbergError(NO_CATALOG)
    throw error
  }
  if (!row)
    throw new GutenbergError(
      `Project Gutenberg book ${id} is not in the English text catalog.`,
    )
  const book: GutenbergBook = {
    id,
    title: row.title,
    author: row.author,
    textUrl: gutenbergTextUrl(id),
  }
  await mkdir(cacheDir, { recursive: true })
  await writeFile(file, JSON.stringify(book), 'utf8')
  return book
}

/**
 * About how many words a Gutenberg book has, from the size of its plain-text file (a HEAD
 * request: the book is not downloaded). The file holds about 18 KB of licence text besides the
 * book, which is taken off before counting about 6 bytes a word (measured on four real books:
 * within about 5 percent).
 */
export const LICENCE_BYTES = 18_000
export const BYTES_PER_WORD = 6
export const wordsFromBytes = (bytes: number): number =>
  Math.max(0, Math.round((bytes - LICENCE_BYTES) / BYTES_PER_WORD))

/**
 * Estimated words for several books, from HEAD requests (a few at a time, never the book itself).
 * Sizes are remembered in cache/gutenberg-sizes.json, so a repeat search asks nothing.
 */
export async function estimateWords(
  ids: number[],
  fetchFn: Fetch = fetch,
  cacheDir: URL = CACHE,
): Promise<Map<number, number | undefined>> {
  const file = new URL('gutenberg-sizes.json', cacheDir)
  let sizes: Record<string, number> = {}
  try {
    sizes = JSON.parse(await readFile(file, 'utf8')) as Record<string, number>
  } catch {
    // Nothing remembered yet.
  }
  const missing = ids.filter((id) => sizes[id] === undefined)
  let next = 0
  const worker = async () => {
    while (next < missing.length) {
      const id = missing[next++]
      try {
        const response = await fetchFn(gutenbergTextUrl(id), {
          method: 'HEAD',
          // Uncompressed: with compression the server reports the size of the zipped file.
          headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity' },
          signal: AbortSignal.timeout(10_000),
        })
        const bytes = Number(response.headers.get('content-length'))
        if (response.ok && bytes > 0) sizes[id] = bytes
      } catch {
        // No estimate for this one.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker))
  if (missing.length > 0) {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(file, JSON.stringify(sizes), 'utf8')
  }
  return new Map(
    ids.map((id) => [
      id,
      sizes[id] === undefined ? undefined : wordsFromBytes(sizes[id]),
    ]),
  )
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

/**
 * A book's raw text, downloaded once and kept in tools/story-guide/cache/<id>.txt. Only a link
 * on gutenberg.org is ever fetched.
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
    throw new GutenbergError('The text link is not on gutenberg.org.')
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
