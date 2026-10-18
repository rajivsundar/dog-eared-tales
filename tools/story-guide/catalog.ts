// Story Guide: a local search of Project Gutenberg's official catalog file (pg_catalog.csv).
// The file is downloaded once into tools/story-guide/cache/ and refreshed only when it is more
// than 7 days old. Searching it needs no network, so it works when Gutendex is down.
// A build-time tool: it never ships in the app.

import { mkdir, rename, stat, writeFile, readFile } from 'node:fs/promises'
import { GutenbergError, USER_AGENT, type Fetch } from './common.ts'

export const CATALOG_URL =
  'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv'
export const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The catalog could not be downloaded and there is no copy on disk. */
export class CatalogUnavailable extends Error {}

/** CSV with quoted fields, doubled quotes and line breaks inside quotes (titles can have them). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export interface CatalogRow {
  id: number
  /** The title's first line, for display. */
  title: string
  /** The first author, as "First Last". */
  author: string
  titleTokens: string[]
  authorTokens: string[]
  /** The words of each author's name on its own, so a name is matched within one person. */
  authorGroups: string[][]
}

export interface CatalogIndex {
  rows: CatalogRow[]
  byId: Map<number, CatalogRow>
}

/** Lower-case words with accents and punctuation removed. */
export function tokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** "Poe, Edgar Allan, 1809-1849" becomes "Edgar Allan Poe". */
export function displayAuthor(authors: string): string {
  const first = (authors.split(/\s*;\s*/)[0] ?? '').replace(
    /\s*\[[^\]]*\]/g,
    '',
  )
  const parts = first.split(/,\s*/).filter(Boolean)
  // A last part with a digit is the life dates.
  if (parts.length > 1 && /\d/.test(parts[parts.length - 1])) parts.pop()
  const [last, ...rest] = parts
  if (!last) return 'Unknown author'
  return rest.length > 0 ? `${rest.join(' ')} ${last}` : last
}

/** The English texts in the catalog file (Type "Text", Language exactly "en"). */
export function buildIndex(csv: string): CatalogIndex {
  const rows: CatalogRow[] = []
  const byId = new Map<number, CatalogRow>()
  const table = parseCsv(csv)
  for (const r of table.slice(1)) {
    const [textNo, type, , title, language, authors] = r
    if (type !== 'Text' || language !== 'en' || !title) continue
    const id = Number(textNo)
    if (!Number.isInteger(id)) continue
    const row: CatalogRow = {
      id,
      title: title.split('\n')[0].replace(/\s+/g, ' ').trim(),
      author: displayAuthor(authors ?? ''),
      // The whole title (subtitle lines too) and every author are searched.
      titleTokens: tokens(title),
      authorTokens: tokens(authors ?? ''),
      authorGroups: (authors ?? '')
        .split(';')
        .map(tokens)
        .filter((group) => group.length > 0),
    }
    rows.push(row)
    byId.set(id, row)
  }
  return { rows, byId }
}

/**
 * The edit distance between two words (a swap of two neighbouring letters counts as one slip),
 * or max + 1 when it is more than max.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let twoAgo: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d = Math.min(d, twoAgo[j - 2] + 1)
      current[j] = d
      if (d < best) best = d
    }
    if (best > max) return max + 1
    twoAgo = previous
    previous = current
  }
  return Math.min(previous[b.length], max + 1)
}

/** How well one query word matches one catalog word: 0 (no) to 1 (exact). */
function wordMatch(query: string, word: string): number {
  if (query === word) return 1
  if (query.length >= 3 && word.startsWith(query)) return 0.85
  if (query.length >= 4) {
    // Up to one slip in a short word, two in a long one.
    const max = query.length >= 8 ? 2 : 1
    const d = editDistance(query, word, max)
    if (d <= max) return d === 1 ? 0.75 : 0.6
  }
  return 0
}

/** The score of a catalog row for the query words; 0 when any word matches nothing. */
export function scoreRow(query: string[], row: CatalogRow): number {
  let total = 0
  let allInTitle = true
  for (const q of query) {
    let inTitle = 0
    let inAuthor = 0
    for (const w of row.titleTokens)
      inTitle = Math.max(inTitle, wordMatch(q, w))
    for (const w of row.authorTokens)
      inAuthor = Math.max(inAuthor, wordMatch(q, w))
    const best = Math.max(inTitle, inAuthor)
    if (best === 0) return 0
    if (inTitle === 0) allInTitle = false
    total += best
  }
  let score = total / query.length
  // Every word inside one title, or inside one author's name, beats words scattered about:
  // "edgar allen" is Edgar Allan Poe, not a book by Edgar Rice Burroughs with an illustrator Allen.
  const oneAuthor = row.authorGroups.some((group) =>
    query.every((q) => group.some((w) => wordMatch(q, w) > 0)),
  )
  if (oneAuthor) score += 0.2
  if (allInTitle) score += 0.1
  // The words in order at the start of the title, or anywhere in it, beat scattered matches.
  const t = row.titleTokens
  if (query.every((q, i) => t[i] === q)) score += 0.3
  else if (t.join(' ').includes(query.join(' '))) score += 0.15
  // Shorter titles are likelier to be what was meant.
  return score - 0.004 * Math.min(t.length, 40)
}

export interface CatalogHit {
  id: number
  title: string
  author: string
}

/** The best matches for a search, by title and author, forgiving small misspellings. */
export function searchIndex(
  index: CatalogIndex,
  query: string,
  limit = 10,
): CatalogHit[] {
  const words = tokens(query)
  if (words.length === 0) return []
  const scored: { row: CatalogRow; score: number }[] = []
  for (const row of index.rows) {
    const score = scoreRow(words, row)
    if (score > 0) scored.push({ row, score })
  }
  scored.sort((a, b) => b.score - a.score || a.row.id - b.row.id)
  return scored
    .slice(0, limit)
    .map(({ row }) => ({ id: row.id, title: row.title, author: row.author }))
}

const CACHE = new URL('./cache/', import.meta.url)
const FILE = 'pg_catalog.csv'

async function downloadCatalog(fetchFn: Fetch, cacheDir: URL): Promise<void> {
  let response: Response
  try {
    response = await fetchFn(CATALOG_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(180_000),
    })
  } catch {
    throw new CatalogUnavailable('the catalog file did not download')
  }
  if (!response.ok)
    throw new CatalogUnavailable(`gutenberg.org answered ${response.status}`)
  const text = await response.text()
  if (!text.startsWith('Text#'))
    throw new CatalogUnavailable('the catalog file was not what was expected')
  await mkdir(cacheDir, { recursive: true })
  // Written aside and renamed, so a half-finished download never replaces a good file.
  const temp = new URL(`${FILE}.part`, cacheDir)
  await writeFile(temp, text, 'utf8')
  await rename(temp, new URL(FILE, cacheDir))
}

let memo: { mtimeMs: number; index: CatalogIndex } | undefined
let loading: Promise<CatalogIndex> | undefined

/**
 * The catalog index. Downloads pg_catalog.csv when there is no copy or the copy is older than 7
 * days; if a refresh fails, an older copy is still used. Throws CatalogUnavailable only when
 * there is no copy at all.
 */
export function loadCatalog(
  fetchFn: Fetch = fetch,
  cacheDir: URL = CACHE,
  now: () => number = Date.now,
): Promise<CatalogIndex> {
  loading ??= (async () => {
    const file = new URL(FILE, cacheDir)
    let info = await stat(file).catch(() => undefined)
    if (!info || now() - info.mtimeMs > CATALOG_MAX_AGE_MS) {
      try {
        await downloadCatalog(fetchFn, cacheDir)
        info = await stat(file)
      } catch (error) {
        if (!info) throw error
        console.error(
          `story-guide: could not refresh the Gutenberg catalog (${(error as Error).message}); using the older copy`,
        )
      }
    }
    if (!info) throw new CatalogUnavailable('no catalog file')
    if (memo?.mtimeMs !== info.mtimeMs)
      memo = {
        mtimeMs: info.mtimeMs,
        index: buildIndex(await readFile(file, 'utf8')),
      }
    return memo.index
  })().finally(() => {
    loading = undefined
  })
  return loading
}

export const resetCatalogMemory = (): void => {
  memo = undefined
  loading = undefined
}

export { GutenbergError }
