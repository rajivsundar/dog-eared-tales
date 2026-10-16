import { describe, expect, it } from 'vitest'
import { readingLevelLabel } from './labels'

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
