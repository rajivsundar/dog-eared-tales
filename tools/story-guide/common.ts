// Story Guide: small things shared by the source modules (Project Gutenberg and Wikisource).
// A build-time tool: it never ships in the app.

/** Sent with every request. Wikimedia's policy asks for a descriptive agent with contact details. */
export const USER_AGENT =
  'DogEaredTalesStoryGuide/1.0 (local hackathon tool; https://github.com/rajivsundar/dog-eared-tales)'

/** A friendly failure: the message is safe to show on the page. */
export class SourceError extends Error {}
export class GutenbergError extends SourceError {}

export type Fetch = typeof fetch

/** The most words the full-story call reads. */
export const MAX_ANALYSED_WORDS = 20_000
export const MAX_RESULTS = 10
export const WORDS_PER_MINUTE = 250

export const LENGTH_FILTERS = ['any', 'short', 'medium', 'long'] as const
export type LengthFilter = (typeof LENGTH_FILTERS)[number]

/** Short is under 5,000 words, Medium 5,000 to 20,000, Long over 20,000. Unknown lengths never match a filter. */
export function matchesLength(
  words: number | undefined,
  filter: LengthFilter,
): boolean {
  if (filter === 'any') return true
  if (words === undefined) return false
  if (filter === 'short') return words < 5_000
  if (filter === 'medium') return words >= 5_000 && words <= 20_000
  return words > 20_000
}

export const minutesFor = (words: number): number =>
  Math.max(1, Math.round(words / WORDS_PER_MINUTE))

/** "about 3,300 words, 13 min": an estimate, rounded so it does not look exact. */
export function lengthLabel(words: number): string {
  const step = words < 1_000 ? 10 : 100
  const rounded = Math.max(step, Math.round(words / step) * step)
  return `about ${rounded.toLocaleString('en-US')} words, ${minutesFor(words)} min`
}

export const countWords = (text: string): number =>
  text.match(/\S+/g)?.length ?? 0

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

/** One search result, from either source. */
export interface SearchResult {
  source: 'gutenberg' | 'wikisource'
  /** The Gutenberg id, or the Wikisource page title. */
  key: string
  title: string
  author: string
  /** An estimate; undefined when it could not be worked out without downloading the book. */
  words?: number
  length?: string
  /** Wikisource only: the licence tag when the page is marked US public domain, else null. */
  license?: string | null
  /** Wikisource only: a versions or disambiguation page lists editions instead of a text. */
  kind?: 'work' | 'editions'
  /** Wikisource only: what a greyed-out result says. */
  note?: string
}
