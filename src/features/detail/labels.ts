import type { CatalogEntry } from '../../catalog'

const LENGTH_LABELS: Record<CatalogEntry['lengthClass'], string> = {
  under10: 'Under 10 minutes',
  '10to30': '10 to 30 minutes',
  '30to60': '30 to 60 minutes',
  '60plus': 'Over an hour',
}

export function lengthLabel(lengthClass: CatalogEntry['lengthClass']): string {
  return LENGTH_LABELS[lengthClass]
}

const BAND_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  challenging: 'Challenging',
} as const

export function readingLevelLabel(level: CatalogEntry['readingLevel']): string {
  return `${BAND_LABELS[level.band]} (grade ${level.grade})`
}

/** The book a collection story comes from, without the Gutenberg subtitle. */
export function bookName(entry: CatalogEntry): string {
  return entry.bookTitle.split(' / ')[0]
}

export function minutesLabel(minutes: number): string {
  return `${minutes} min`
}
