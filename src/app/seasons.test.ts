import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WELCOME,
  SEASONS,
  activeSeason,
  isInSeason,
  welcomeContent,
} from './seasons'

// Local dates, as the reader's clock would give them (months count from 0 in Date).
const on = (month: number, day: number) => new Date(2026, month - 1, day, 12)

const FALL = {
  headline: 'Fall for the classics.',
  subline: 'Great free stories, picked for you. Start short.',
  primaryButton: 'Turn over a new leaf',
  featuredStoryId: 'pg-2148-the-tell-tale-heart',
  coverIds: [
    'pg-2148-the-tell-tale-heart',
    'pg-932-the-fall-of-the-house-of-usher',
    'pg-14522-the-canterville-ghost',
  ],
}

describe('the seasons', () => {
  it('ships fall (Oct 1 – Nov 30) with halloween (Oct 25–31) inside it', () => {
    expect(SEASONS.map((s) => s.id)).toEqual(['fall'])
    const fall = SEASONS[0]
    expect(fall.start).toEqual({ month: 10, day: 1 })
    expect(fall.end).toEqual({ month: 11, day: 30 })
    expect(fall.subSeasons?.map((s) => s.id)).toEqual(['halloween'])
    expect(fall.subSeasons?.[0].start).toEqual({ month: 10, day: 25 })
    expect(fall.subSeasons?.[0].end).toEqual({ month: 10, day: 31 })
  })

  it('gives each season exactly three covers', () => {
    for (const season of [
      ...SEASONS,
      ...SEASONS.flatMap((s) => s.subSeasons ?? []),
    ]) {
      expect(season.coverIds, season.id).toHaveLength(3)
    }
  })
})

describe('fall', () => {
  it('is active on Oct 16', () => {
    expect(activeSeason(on(10, 16))?.id).toBe('fall')
    const content = welcomeContent(on(10, 16))
    expect(content).toMatchObject({ seasonId: 'fall', ...FALL })
  })

  it('runs from Oct 1 to Nov 30, both days included', () => {
    expect(activeSeason(on(9, 30))).toBeUndefined()
    expect(activeSeason(on(10, 1))?.id).toBe('fall')
    expect(activeSeason(on(11, 30))?.id).toBe('fall')
  })

  it('switches off on Dec 1', () => {
    expect(activeSeason(on(12, 1))).toBeUndefined()
    expect(welcomeContent(on(12, 1))).toEqual({ ...DEFAULT_WELCOME })
  })

  it('is still fall (not halloween) on Oct 24 and on Nov 1', () => {
    expect(activeSeason(on(10, 24))?.id).toBe('fall')
    expect(activeSeason(on(11, 1))?.id).toBe('fall')
  })
})

describe('halloween (a sub-season of fall)', () => {
  it('is active on Oct 25 and on Oct 31', () => {
    expect(activeSeason(on(10, 25))?.id).toBe('halloween')
    expect(activeSeason(on(10, 31))?.id).toBe('halloween')
    expect(activeSeason(on(10, 28))?.id).toBe('halloween')
  })

  it('is not active on Nov 1', () => {
    expect(activeSeason(on(11, 1))?.id).not.toBe('halloween')
    expect(activeSeason(on(11, 1))?.id).toBe('fall')
  })

  it('has the same welcome content as fall for now', () => {
    expect(welcomeContent(on(10, 31))).toMatchObject({
      seasonId: 'halloween',
      ...FALL,
    })
  })
})

describe('outside every season', () => {
  it('shows the defaults: headline, subline, button, The Open Window and three covers', () => {
    for (const date of [on(1, 15), on(3, 3), on(7, 4), on(9, 30), on(12, 25)]) {
      expect(activeSeason(date), date.toDateString()).toBeUndefined()
      expect(welcomeContent(date)).toEqual({
        headline: 'Great free stories, picked for you.',
        subline: 'Start short. Fall for the classics.',
        primaryButton: 'Read a short story now',
        featuredStoryId: 'pg-269-the-open-window',
        coverIds: [
          'pg-269-the-open-window',
          'pg-2148-the-tell-tale-heart',
          'pg-7256-the-gift-of-the-magi',
        ],
      })
    }
  })
})

describe('season dates', () => {
  it('uses local time: late on Oct 31 is still halloween, early on Nov 1 is not', () => {
    expect(activeSeason(new Date(2026, 9, 31, 23, 59))?.id).toBe('halloween')
    expect(activeSeason(new Date(2026, 10, 1, 0, 1))?.id).toBe('fall')
  })

  it('works the same in any year', () => {
    expect(activeSeason(new Date(2031, 9, 16))?.id).toBe('fall')
    expect(activeSeason(new Date(2031, 11, 1))).toBeUndefined()
  })

  it('handles a season that runs across New Year', () => {
    const winter = {
      start: { month: 12, day: 15 },
      end: { month: 1, day: 5 },
    }
    expect(isInSeason(winter, on(12, 20))).toBe(true)
    expect(isInSeason(winter, on(1, 3))).toBe(true)
    expect(isInSeason(winter, on(1, 6))).toBe(false)
    expect(isInSeason(winter, on(12, 14))).toBe(false)
  })

  it('lets a sub-season win over its season, and a season over nothing', () => {
    const seasons = [
      {
        ...SEASONS[0],
        id: 'outer',
        start: { month: 5, day: 1 },
        end: { month: 5, day: 31 },
        subSeasons: [
          {
            ...SEASONS[0],
            id: 'inner',
            start: { month: 5, day: 10 },
            end: { month: 5, day: 12 },
            subSeasons: undefined,
          },
        ],
      },
    ]
    expect(activeSeason(on(5, 11), seasons)?.id).toBe('inner')
    expect(activeSeason(on(5, 20), seasons)?.id).toBe('outer')
    expect(activeSeason(on(6, 1), seasons)).toBeUndefined()
  })
})
