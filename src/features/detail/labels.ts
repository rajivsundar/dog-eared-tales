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

const MAX_GRADE_SHOWN = 12

export function readingLevelLabel(level: CatalogEntry['readingLevel']): string {
  // A band set by hand has no honest grade to show.
  if (level.adjusted) return BAND_LABELS[level.band]
  // Grades above 12 are shown as 12+. The catalog keeps the raw value.
  const grade =
    level.grade > MAX_GRADE_SHOWN ? `${MAX_GRADE_SHOWN}+` : level.grade
  return `${BAND_LABELS[level.band]} (grade ${grade})`
}

/** The year as shown: "c. 500 BCE" or "c. 175 CE" for an ancient work, otherwise the plain year. */
export function yearLabel(
  entry: Pick<CatalogEntry, 'year' | 'yearBasis'>,
): string {
  if (entry.yearBasis !== 'composition-approx') return String(entry.year)
  return entry.year < 0 ? `c. ${-entry.year} BCE` : `c. ${entry.year} CE`
}

/** "Translated by Lionel Giles, 1910", or an empty string when no translator is recorded. */
export function translationLabel(
  entry: Pick<CatalogEntry, 'translator' | 'translationYear'>,
): string {
  if (!entry.translator) return ''
  return entry.translationYear
    ? `Translated by ${entry.translator}, ${entry.translationYear}`
    : `Translated by ${entry.translator}`
}

/** The book a collection story comes from, without the Gutenberg subtitle. */
export function bookName(entry: CatalogEntry): string {
  return entry.bookTitle.split(' / ')[0]
}

export function minutesLabel(minutes: number): string {
  return `${minutes} min`
}
