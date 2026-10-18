// Story Guide: one search over Project Gutenberg, Wikisource or both, with a length filter.
// The sources are passed in, so this can be tested without a network. A build-time tool: it never
// ships in the app.

import {
  MAX_RESULTS,
  SourceError,
  lengthLabel,
  matchesLength,
  type LengthFilter,
  type SearchResult,
} from './common.ts'
import type { GutenbergResult } from './gutenberg.ts'
import {
  wikisourceResult,
  type PageInfo,
  type WikisourceHit,
} from './wikisource.ts'

export const SOURCES = ['gutenberg', 'wikisource', 'both'] as const
export type SourceChoice = (typeof SOURCES)[number]

export interface SearchSources {
  gutenbergSearch(query: string, limit: number): Promise<GutenbergResult[]>
  gutenbergWords(ids: number[]): Promise<Map<number, number | undefined>>
  wikisourceSearch(query: string, limit: number): Promise<WikisourceHit[]>
  wikisourceDescribe(titles: string[]): Promise<Map<string, PageInfo>>
}

/** With a length filter on, this many matches are measured, so enough of them can pass it. */
const GUTENBERG_CANDIDATES = 40
const WIKISOURCE_CANDIDATES = 50

const withLength = (r: SearchResult): SearchResult =>
  r.words === undefined ? r : { ...r, length: lengthLabel(r.words) }

async function searchGutenbergSource(
  query: string,
  length: LengthFilter,
  sources: SearchSources,
): Promise<SearchResult[]> {
  const filtering = length !== 'any'
  const found = await sources.gutenbergSearch(
    query,
    filtering ? GUTENBERG_CANDIDATES : MAX_RESULTS,
  )
  const words = await sources.gutenbergWords(found.map((b) => b.id))
  return found
    .map((b): SearchResult =>
      withLength({
        source: 'gutenberg',
        key: String(b.id),
        title: b.title,
        author: b.author,
        words: words.get(b.id),
      }),
    )
    .filter((r) => matchesLength(r.words, length))
    .slice(0, MAX_RESULTS)
}

async function searchWikisourceSource(
  query: string,
  length: LengthFilter,
  sources: SearchSources,
): Promise<SearchResult[]> {
  const found = (await sources.wikisourceSearch(query, WIKISOURCE_CANDIDATES))
    .filter((hit) => matchesLength(hit.words, length))
    .slice(0, MAX_RESULTS)
  const details = await sources.wikisourceDescribe(found.map((h) => h.title))
  return found.map((hit) =>
    withLength(wikisourceResult(hit.title, details.get(hit.title), hit.words)),
  )
}

/**
 * The top results for a search, from one source or both, each with source, author and an
 * estimated length. When one source fails and the other works, the failure is a note, not an
 * error.
 */
export async function searchSources(
  query: string,
  source: SourceChoice,
  length: LengthFilter,
  sources: SearchSources,
): Promise<{ results: SearchResult[]; notes: string[] }> {
  const jobs: { name: string; run: () => Promise<SearchResult[]> }[] = []
  if (source !== 'wikisource')
    jobs.push({
      name: 'Project Gutenberg',
      run: () => searchGutenbergSource(query, length, sources),
    })
  if (source !== 'gutenberg')
    jobs.push({
      name: 'Wikisource',
      run: () => searchWikisourceSource(query, length, sources),
    })

  const settled = await Promise.allSettled(jobs.map((j) => j.run()))
  const results: SearchResult[] = []
  const notes: string[] = []
  let firstError: unknown
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') results.push(...outcome.value)
    else {
      firstError ??= outcome.reason
      const reason = outcome.reason as Error
      notes.push(
        `${jobs[i].name}: ${reason instanceof SourceError ? reason.message : 'something went wrong (see the terminal)'}`,
      )
    }
  })
  if (settled.every((o) => o.status === 'rejected')) throw firstError
  return { results, notes }
}
