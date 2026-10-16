/**
 * Seasons change the welcome page: its headline, subline, main button, featured story and covers.
 * Dates are month and day in the reader's local time, and both ends are included.
 * A season can hold sub-seasons (Halloween inside fall); the most specific one wins.
 */

export interface MonthDay {
  /** 1 to 12. */
  month: number
  day: number
}

export interface Season {
  id: string
  start: MonthDay
  end: MonthDay
  headline: string
  subline: string
  /** The label on the main welcome button. */
  primaryButton: string
  /** The short story (under 10 minutes) that the main button opens. */
  featuredStoryId: string
  /** Exactly three covers for the welcome fan. */
  coverIds: [string, string, string]
  subSeasons?: Season[]
}

/** What the welcome page shows when no season is active. */
export const DEFAULT_WELCOME = {
  headline: 'Great free stories, picked for you.',
  subline: 'Start short. Fall for the classics.',
  primaryButton: 'Read a short story now',
  featuredStoryId: 'pg-269-the-open-window',
  coverIds: [
    'pg-269-the-open-window',
    'pg-2148-the-tell-tale-heart',
    'pg-7256-the-gift-of-the-magi',
  ] as [string, string, string],
}

const TELL_TALE_HEART = 'pg-2148-the-tell-tale-heart'
const HOUSE_OF_USHER = 'pg-932-the-fall-of-the-house-of-usher'
const CANTERVILLE_GHOST = 'pg-14522-the-canterville-ghost'

export const SEASONS: Season[] = [
  {
    id: 'fall',
    start: { month: 10, day: 1 },
    end: { month: 11, day: 30 },
    headline: 'Fall for the classics.',
    subline: 'Great free stories, picked for you. Start short.',
    primaryButton: 'Turn over a new leaf',
    featuredStoryId: TELL_TALE_HEART,
    coverIds: [TELL_TALE_HEART, HOUSE_OF_USHER, CANTERVILLE_GHOST],
    subSeasons: [
      {
        id: 'halloween',
        start: { month: 10, day: 25 },
        end: { month: 10, day: 31 },
        // The same as fall for now; a later step adds its own row title.
        headline: 'Fall for the classics.',
        subline: 'Great free stories, picked for you. Start short.',
        primaryButton: 'Turn over a new leaf',
        featuredStoryId: TELL_TALE_HEART,
        coverIds: [TELL_TALE_HEART, HOUSE_OF_USHER, CANTERVILLE_GHOST],
      },
    ],
  },
]

const key = (d: MonthDay): number => d.month * 100 + d.day

/** Is this date (in local time) inside the season? A season may run across New Year. */
export function isInSeason(
  season: Pick<Season, 'start' | 'end'>,
  date: Date,
): boolean {
  const today = (date.getMonth() + 1) * 100 + date.getDate()
  const start = key(season.start)
  const end = key(season.end)
  return start <= end
    ? today >= start && today <= end
    : today >= start || today <= end
}

/** The most specific season active on this date, or undefined outside every season. */
export function activeSeason(
  date: Date,
  seasons: Season[] = SEASONS,
): Season | undefined {
  for (const season of seasons) {
    if (!isInSeason(season, date)) continue
    return activeSeason(date, season.subSeasons ?? []) ?? season
  }
  return undefined
}

export interface WelcomeContent {
  /** The season behind this content, if any. */
  seasonId?: string
  headline: string
  subline: string
  primaryButton: string
  featuredStoryId: string
  coverIds: readonly string[]
}

/** The welcome content for a date: the active season's, or the defaults. */
export function welcomeContent(
  date: Date,
  seasons: Season[] = SEASONS,
): WelcomeContent {
  const season = activeSeason(date, seasons)
  if (!season) return { ...DEFAULT_WELCOME }
  return {
    seasonId: season.id,
    headline: season.headline,
    subline: season.subline,
    primaryButton: season.primaryButton,
    featuredStoryId: season.featuredStoryId,
    coverIds: season.coverIds,
  }
}
