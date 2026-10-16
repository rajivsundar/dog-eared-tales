import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { ReaderEvent, ReaderEventType } from '../../stores'
import {
  LONG_LIST_SIZE,
  dayKey,
  isLongListUnlocked,
  longListReason,
  positiveFinishes,
  recommendLongList,
  rotatedOut,
} from './longList'
import {
  DEFAULT_SITTING_MINUTES,
  sittingMinutes,
  sittingsFor,
  sittingsLabel,
} from './sessions'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 16, 12)

function entry(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    title: `Title ${id}`,
    author: 'A',
    language: 'en',
    bookTitle: id,
    isCollection: false,
    wordCount: 20000,
    readingMinutes: 60,
    lengthClass: '60plus',
    readingLevel: { grade: 8, band: 'medium' },
    firstLine: 'Once.',
    textUrl: '',
    coverUrl: '',
    startHref: 'a#b',
    endHref: 'a#c',
    sha256: '',
    source: '',
    sourceUrl: '',
    license: '',
    year: 1900,
    eraBand: '1850-1899',
    form: 'novella',
    genres: ['ghost story'],
    moods: ['eerie'],
    contentNotes: [],
    hook: '',
    blurb: '',
    generatedBy: 'claude-code',
    reviewed: true,
    ...changes,
  } as CatalogEntry
}

let tick = 0
function ev(
  workId: string,
  type: ReaderEventType,
  extra: Partial<ReaderEvent> = {},
): ReaderEvent {
  tick++
  return { id: `e${tick}`, workId, type, at: NOW - 100000 + tick, ...extra }
}

// Three short stories the reader has read, and some long works to offer.
const read = [
  entry('r1', {
    form: 'story',
    title: 'The Signal-Man',
    lengthClass: 'under10',
    readingMinutes: 8,
  }),
  entry('r2', {
    form: 'story',
    moods: ['funny'],
    genres: ['humour'],
    lengthClass: 'under10',
    readingMinutes: 8,
  }),
  entry('r3', {
    form: 'story',
    moods: ['cozy'],
    genres: ['romance'],
    lengthClass: 'under10',
    readingMinutes: 8,
  }),
]
const longWorks = [
  entry('l1', { form: 'novella' }),
  entry('l2', { form: 'novelette', moods: ['funny'], genres: ['humour'] }),
  entry('l3', { form: 'novella', moods: ['cozy'], genres: ['romance'] }),
  entry('l4', { form: 'novelette', moods: ['tense'], genres: ['mystery'] }),
  entry('l5', { form: 'novella', moods: ['dark'], genres: ['horror'] }),
  entry('l6', { form: 'novelette', moods: ['hopeful'], genres: ['adventure'] }),
]
const essay = entry('e1', { form: 'essay' })
const shortStory = entry('s1', { form: 'story' })
const catalog = [...read, ...longWorks, essay, shortStory]

const positive = (ids: string[], rating: 'love' | 'ok' = 'love') =>
  ids.flatMap((id) => [ev(id, 'finished'), ev(id, rating)])
const three = positive(['r1', 'r2', 'r3'])
const profile = {
  facetBeliefs: {} as Record<string, { success: number; failure: number }>,
}
const run = (events: ReaderEvent[], avoid: string[] = [], p = profile) =>
  recommendLongList({ catalog, profile: p, events, avoid })

describe('when the Long List appears', () => {
  it('is hidden before 3 finished works rated Loved it or It was OK', () => {
    expect(isLongListUnlocked([])).toBe(false)
    expect(run([])).toEqual([])
    expect(run(positive(['r1', 'r2']))).toEqual([])
  })

  it('appears once there are 3', () => {
    expect(isLongListUnlocked(three)).toBe(true)
    expect(run(three).length).toBeGreaterThan(0)
  })

  it('counts It was OK as well as Loved it', () => {
    const mixed = [...positive(['r1', 'r2'], 'love'), ...positive(['r3'], 'ok')]
    expect(positiveFinishes(mixed)).toBe(3)
    expect(isLongListUnlocked(mixed)).toBe(true)
  })

  it('does not count a finish with no rating, a Not for me, or a rating without a finish', () => {
    const events = [
      ev('r1', 'finished'),
      ...positive(['r2']),
      ev('r3', 'finished'),
      ev('r3', 'notForMe'),
      ev('l1', 'love'),
    ]
    expect(positiveFinishes(events)).toBe(1)
    expect(isLongListUnlocked(events)).toBe(false)
  })

  it('starts counting again after a taste reset', () => {
    const afterReset = [...three, ev('taste', 'reset'), ...positive(['r1'])]
    expect(positiveFinishes(afterReset)).toBe(1)
    expect(run(afterReset)).toEqual([])
  })
})

describe('what it offers', () => {
  it('offers only novelettes and novellas, never stories or essays', () => {
    const picks = run(three)
    expect(picks.length).toBeGreaterThan(0)
    for (const p of picks) {
      expect(['novelette', 'novella']).toContain(p.entry.form)
    }
    const all = recommendLongList({
      catalog,
      profile,
      events: three,
      avoid: [],
      count: 50,
    })
    expect(all.map((p) => p.entry.id)).not.toContain('e1')
    expect(all.map((p) => p.entry.id)).not.toContain('s1')
  })

  it('offers at most 4', () => {
    expect(run(three)).toHaveLength(LONG_LIST_SIZE)
  })

  it('skips finished works and Not for me works', () => {
    const events = [...three, ...positive(['l1']), ev('l2', 'notForMe')]
    const ids = run(events).map((p) => p.entry.id)
    expect(ids).not.toContain('l1')
    expect(ids).not.toContain('l2')
  })

  it('skips anything on today’s shortlist', () => {
    const ids = run(three, ['l1', 'l2']).map((p) => p.entry.id)
    expect(ids).not.toContain('l1')
    expect(ids).not.toContain('l2')
    expect(ids).toHaveLength(4)
  })

  it('ranks by the learned mood and genre weights', () => {
    const likesFunny = {
      facetBeliefs: {
        'mood:funny': { success: 6, failure: 0 },
        'genre:humour': { success: 6, failure: 0 },
      },
    }
    expect(run(three, [], likesFunny)[0].entry.id).toBe('l2')
    const likesCozy = {
      facetBeliefs: {
        'mood:cozy': { success: 6, failure: 0 },
        'genre:romance': { success: 6, failure: 0 },
      },
    }
    expect(run(three, [], likesCozy)[0].entry.id).toBe('l3')
  })
})

describe('the strong-negative cap', () => {
  const dislikes = (net: number) => ({
    facetBeliefs: { 'length:60plus': { success: 0, failure: net } },
  })

  it('shows at most 1 when the weight for the longest reads is below -2', () => {
    expect(run(three, [], dislikes(2.5))).toHaveLength(1)
    expect(run(three, [], dislikes(5))).toHaveLength(1)
  })

  it('shows the usual 4 at -2 exactly, or when milder', () => {
    expect(run(three, [], dislikes(2))).toHaveLength(4)
    expect(run(three, [], dislikes(1))).toHaveLength(4)
  })
})

describe('the reason line', () => {
  it('names a rated work that shares a genre: "You loved The Signal-Man — try a longer ghost story"', () => {
    const picks = run(three)
    const ghost = picks.find((p) => p.entry.id === 'l1')!
    expect(ghost.reason).toBe(
      'You loved The Signal-Man — try a longer ghost story',
    )
  })

  it('says "liked" for It was OK, and uses the most recent matching work', () => {
    const events = [...positive(['r1'], 'ok'), ...positive(['r2', 'r3'])]
    expect(longListReason(longWorks[0], catalog, events, {})).toBe(
      'You liked The Signal-Man — try a longer ghost story',
    )
  })

  it('falls back to a taste line when no rated work matches', () => {
    const odd = entry('l9', { moods: ['whimsical'], genres: ['satire'] })
    expect(
      longListReason(odd, catalog, three, {
        'mood:whimsical': { success: 2, failure: 0 },
      }),
    ).toBe('Matches your taste for whimsical stories')
    expect(longListReason(odd, catalog, three, {})).toBe(
      'A longer read, for when you are ready',
    )
  })
})

describe('rotating out unread picks', () => {
  const shownOn = (id: string, days: number[]) =>
    days.map((d) => ev(id, 'shown', { at: NOW - d * DAY }))

  it('rotates a pick out after it was shown on 7 different days without a tap', () => {
    const six = shownOn('l1', [1, 2, 3, 4, 5, 6])
    expect(rotatedOut(six).has('l1')).toBe(false)
    const seven = shownOn('l1', [1, 2, 3, 4, 5, 6, 7])
    expect(rotatedOut(seven).has('l1')).toBe(true)
    expect(run([...three, ...seven]).map((p) => p.entry.id)).not.toContain('l1')
  })

  it('counts days, not showings', () => {
    const sameDay = Array.from({ length: 10 }, (_, i) =>
      ev('l1', 'shown', { at: NOW - 1000 * i }),
    )
    expect(rotatedOut(sameDay).has('l1')).toBe(false)
  })

  it('starts the count again after a tap', () => {
    const events = [
      ...shownOn('l1', [10, 9, 8, 7, 6, 5, 4]),
      ev('l1', 'tap', { at: NOW - 3 * DAY }),
      ...shownOn('l1', [2, 1]),
    ]
    expect(rotatedOut(events).has('l1')).toBe(false)
    expect(rotatedOut(shownOn('l1', [10, 9, 8, 7, 6, 5, 4])).has('l1')).toBe(
      true,
    )
  })

  it('does not use the shortlist’s 3-shows penalty', () => {
    const three3 = shownOn('l1', [1, 2, 3])
    expect(rotatedOut(three3).has('l1')).toBe(false)
    expect(run([...three, ...three3]).map((p) => p.entry.id)).toContain('l1')
  })

  it('names the local day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
  })
})

describe('sittings', () => {
  const session = (seconds: number, n: number) =>
    ev('w', 'session', { value: seconds, at: NOW + n })
  const sessions = (list: number[]) => list.map((s, i) => session(s, i))

  it('defaults to 15 minutes until there are 3 real sessions', () => {
    expect(sittingMinutes([])).toBe(DEFAULT_SITTING_MINUTES)
    expect(sittingMinutes(sessions([1200, 1200]))).toBe(15)
    // Sessions under 30 seconds are not real.
    expect(sittingMinutes(sessions([1200, 1200, 20]))).toBe(15)
  })

  it('is the median of the sessions, rounded to the nearest 5 minutes', () => {
    // 20, 30, 40 minutes: median 30.
    expect(sittingMinutes(sessions([1200, 2400, 1800]))).toBe(30)
    // 11, 12, 13 minutes: median 12, rounds to 10.
    expect(sittingMinutes(sessions([660, 720, 780]))).toBe(10)
    // 13, 14, 15 minutes: median 14, rounds to 15.
    expect(sittingMinutes(sessions([780, 840, 900]))).toBe(15)
    // Even count: the middle two are averaged. 20 and 30 minutes make 25.
    expect(sittingMinutes(sessions([600, 1200, 1800, 2400]))).toBe(25)
  })

  it('never goes below 5 minutes', () => {
    expect(sittingMinutes(sessions([40, 45, 50]))).toBe(5)
  })

  it('uses only the last 10 sessions', () => {
    const old = Array.from({ length: 10 }, () => 3600) // 60 minutes
    const recent = Array.from({ length: 10 }, () => 600) // 10 minutes
    expect(sittingMinutes(sessions([...old, ...recent]))).toBe(10)
  })

  it('ignores other events', () => {
    expect(
      sittingMinutes([
        ...sessions([1800, 1800, 1800]),
        ev('w', 'open', { value: 5 }),
      ]),
    ).toBe(30)
  })

  it('turns total minutes into sittings', () => {
    expect(sittingsFor(60, 15)).toBe(4)
    expect(sittingsFor(61, 15)).toBe(5)
    expect(sittingsFor(5, 15)).toBe(1)
    expect(sittingsLabel(60, 15)).toBe('About 4 sittings of 15 min')
    expect(sittingsLabel(10, 15)).toBe('About 1 sitting of 15 min')
    expect(sittingsLabel(137, 30)).toBe('About 5 sittings of 30 min')
  })
})
