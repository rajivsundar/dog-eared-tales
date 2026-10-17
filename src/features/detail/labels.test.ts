import { describe, expect, it } from 'vitest'
import { readingLevelLabel, translationLabel, yearLabel } from './labels'

describe('readingLevelLabel', () => {
  it('shows the band and the grade', () => {
    expect(readingLevelLabel({ grade: 6, band: 'easy' })).toBe('Easy (grade 6)')
    expect(readingLevelLabel({ grade: 9, band: 'medium' })).toBe(
      'Medium (grade 9)',
    )
    expect(readingLevelLabel({ grade: 12, band: 'challenging' })).toBe(
      'Challenging (grade 12)',
    )
  })

  it('shows only the band when it was set by hand', () => {
    expect(
      readingLevelLabel({ grade: 6, band: 'medium', adjusted: true }),
    ).toBe('Medium')
  })

  it('caps the grade at 12', () => {
    expect(readingLevelLabel({ grade: 13, band: 'challenging' })).toBe(
      'Challenging (grade 12+)',
    )
    expect(readingLevelLabel({ grade: 19.4, band: 'challenging' })).toBe(
      'Challenging (grade 12+)',
    )
  })

  it('leaves the catalog value alone', () => {
    const level = { grade: 15, band: 'challenging' as const }
    readingLevelLabel(level)
    expect(level.grade).toBe(15)
  })
})

describe('yearLabel and translationLabel', () => {
  it('shows an ancient year as c. BCE or CE, and other years plainly', () => {
    expect(yearLabel({ year: -500, yearBasis: 'composition-approx' })).toBe(
      'c. 500 BCE',
    )
    expect(yearLabel({ year: 175, yearBasis: 'composition-approx' })).toBe(
      'c. 175 CE',
    )
    expect(yearLabel({ year: 1894, yearBasis: 'first-print' })).toBe('1894')
    expect(yearLabel({ year: 1894 })).toBe('1894')
  })

  it('names the translator and year, when recorded', () => {
    expect(
      translationLabel({ translator: 'Lionel Giles', translationYear: 1910 }),
    ).toBe('Translated by Lionel Giles, 1910')
    expect(translationLabel({ translator: 'Lionel Giles' })).toBe(
      'Translated by Lionel Giles',
    )
    expect(translationLabel({})).toBe('')
  })
})
