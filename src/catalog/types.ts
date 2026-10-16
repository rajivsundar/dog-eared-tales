// One entry of public/catalog/catalog.json, written by scripts/build-catalog.ts.
// Keep this in step with CatalogEntry in that script.

export type LengthClass = 'under10' | '10to30' | '30to60' | '60plus'
export type ReadingBand = 'easy' | 'medium' | 'challenging'

export interface CatalogEntry {
  id: string
  title: string
  author: string
  language: string
  /** The EPUB's own title. Shown as "from <book>" for collection entries. */
  bookTitle: string
  isCollection: boolean
  wordCount: number
  readingMinutes: number
  lengthClass: LengthClass
  readingLevel: { grade: number; band: ReadingBand }
  firstLine: string
  /** Where the EPUB is served from, for example /texts/pg-1661.epub. */
  textUrl: string
  coverUrl: string
  /** Where the story starts inside the EPUB. Null for a single work. */
  startHref: string
  /** Where the next story starts, so this one ends. Null for a single work. */
  endHref: string
  sha256: string
  source: string
  sourceUrl: string
  license: string
  year: number
  eraBand: string
  form: 'story' | 'novelette' | 'novella' | 'essay'
  genres: string[]
  moods: string[]
  contentNotes: string[]
  hook: string
  blurb: string
  generatedBy: string
  reviewed: boolean
}
