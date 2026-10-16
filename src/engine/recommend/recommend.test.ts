import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { ReaderEvent, ReaderEventType } from '../../stores'
import { recommend } from './recommend'
import { digestEvents } from './history'
import { facetWeight, lengthFit, scoreEntry, shownPenalty } from './score'

let counter = 0
function entry(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    title: id,
    author: 'Author',
    language: 'en',
    bookTitle: id,
    isCollection: false,
    wordCount: 2000,
    readingMinutes: 8,
    lengthClass: 'under10',
    readingLevel: { grade: 6, band: 'easy' },
    firstLine: 'Once.',
    textUrl: '',
    coverUrl: '',
    startHref: '',
    endHref: '',
    sha256: '',
    source: '',
    sourceUrl: '',
    license: '',
    year: 1900,
    eraBand: 'victorian',
    form: 'story',
    genres: ['literary'],
    moods: ['cozy'],
    contentNotes: [],
    hook: '',
    blurb: '',
    generatedBy: 'claude-code',
    reviewed: true,
    ...changes,
  } as CatalogEntry
}

function event(
  workId: string,
  type: ReaderEventType,
  at = ++counter,
): ReaderEvent {
  return { id: `e${at}-${workId}-${type}`, workId, type, at }
}

function shown(workId: string, times: number): ReaderEvent[] {
  return Array.from({ length: times }, () => event(workId, 'shown'))
}

const eerieFan = {
  facetBeliefs: {
    'mood:eerie': { success: 8, failure: 0 },
    'genre:horror': { success: 6, failure: 0 },
  },
  ladderLevel: 0,
}

const catalog: CatalogEntry[] = [
  entry('a-eerie', { moods: ['eerie'], genres: ['horror'] }),
  entry('b-eerie2', {
    moods: ['eerie'],
    genres: ['horror'],
    lengthClass: '10to30',
    readingMinutes: 20,
  }),
  entry('c-eerie3', {
    moods: ['eerie', 'dark'],
    genres: ['ghost story'],
    lengthClass: '10to30',
  }),
  entry('d-cozy', { moods: ['cozy'], genres: ['romance'] }),
  entry('e-funny-essay', {
    form: 'essay',
    moods: ['funny'],
    genres: ['humour'],
    lengthClass: '10to30',
  }),
  entry('f-long', {
    moods: ['eerie'],
    genres: ['horror'],
    lengthClass: '60plus',
    readingMinutes: 90,
  }),
  entry('g-tense', {
    moods: ['tense'],
    genres: ['mystery'],
    lengthClass: '30to60',
  }),
  entry('h-hopeful', {
    moods: ['hopeful'],
    genres: ['adventure'],
    lengthClass: '30to60',
  }),
]

describe('scoring', () => {
  it('gives an untouched facet a weight of 0.5, and moves it with the reader', () => {
    expect(facetWeight({}, 'mood:eerie')).toBe(0.5)
    expect(
      facetWeight({ 'mood:eerie': { success: 8, failure: 0 } }, 'mood:eerie'),
    ).toBeCloseTo(0.9)
    expect(
      facetWeight({ 'mood:eerie': { success: 0, failure: 8 } }, 'mood:eerie'),
    ).toBeCloseTo(0.1)
  })

  it('scores matching moods and genres above non-matching ones', () => {
    const history = digestEvents([])
    const ctx = {
      beliefs: eerieFan.facetBeliefs,
      preferred: 'under10' as const,
      history,
    }
    const match = scoreEntry(catalog[0], ctx).score
    const other = scoreEntry(catalog[3], ctx).score
    expect(match).toBeGreaterThan(other)
  })

  it("prefers the reader's length class and fades with distance", () => {
    expect(lengthFit('under10', 'under10')).toBe(1)
    expect(lengthFit('10to30', 'under10')).toBe(0.6)
    expect(lengthFit('60plus', 'under10')).toBe(0.1)
    expect(lengthFit('under10', '60plus')).toBe(0.1)
  })

  it('gives a small bonus to stories never shown', () => {
    const ctx = { beliefs: {}, preferred: 'under10' as const }
    const fresh = scoreEntry(entry('x'), {
      ...ctx,
      history: digestEvents([]),
    }).score
    const stale = scoreEntry(entry('x'), {
      ...ctx,
      history: digestEvents(shown('x', 2)),
    }).score
    expect(fresh).toBeGreaterThan(stale)
    expect(fresh - stale).toBeLessThan(0.1)
  })

  it('halves the score after 3 showings with no tap, and resets on a tap', () => {
    expect(shownPenalty('x', digestEvents(shown('x', 2)))).toBe(1)
    expect(shownPenalty('x', digestEvents(shown('x', 3)))).toBe(0.5)
    expect(shownPenalty('x', digestEvents(shown('x', 6)))).toBe(0.25)
    expect(
      shownPenalty('x', digestEvents([...shown('x', 5), event('x', 'tap')])),
    ).toBe(1)
    expect(
      shownPenalty('x', digestEvents([event('x', 'tap'), ...shown('x', 3)])),
    ).toBe(0.5)
  })

  it('drops an entry out of the shortlist after 3 ignored showings', () => {
    const before = recommend({ catalog, profile: eerieFan, events: [] })
    const events = shown('a-eerie', 3)
    const after = recommend({ catalog, profile: eerieFan, events })
    const rank = (r: typeof before) =>
      r.picks.findIndex((p) => p.entry.id === 'a-eerie')
    expect(rank(before)).toBe(0)
    expect(rank(after)).not.toBe(0)
  })
})

describe('exclusions', () => {
  it('never picks finished or not-for-me entries', () => {
    const events = [event('a-eerie', 'finished'), event('b-eerie2', 'notForMe')]
    const ids = recommend({ catalog, profile: eerieFan, events }).picks.map(
      (p) => p.entry.id,
    )
    expect(ids).not.toContain('a-eerie')
    expect(ids).not.toContain('b-eerie2')
  })

  it('also applies to the starter mix', () => {
    const events = [event('a-eerie', 'finished'), event('d-cozy', 'notForMe')]
    const ids = recommend({ catalog, profile: null, events }).picks.map(
      (p) => p.entry.id,
    )
    expect(ids).not.toContain('a-eerie')
    expect(ids).not.toContain('d-cozy')
  })

  it('lets an undo cancel not-for-me, but not an undo of an un-dog-ear', () => {
    const hidden = [event('a-eerie', 'notForMe')]
    const ids = (events: ReaderEvent[]) =>
      recommend({ catalog, profile: eerieFan, events }).picks.map(
        (p) => p.entry.id,
      )
    expect(ids(hidden)).not.toContain('a-eerie')
    expect(ids([...hidden, event('a-eerie', 'undo')])).toContain('a-eerie')
    const unsave = { ...event('a-eerie', 'undo'), reason: 'unsave' }
    expect(ids([...hidden, unsave])).not.toContain('a-eerie')
  })

  it('still offers a story the reader opened but did not finish', () => {
    const events = [event('a-eerie', 'open')]
    const ids = recommend({ catalog, profile: eerieFan, events }).picks.map(
      (p) => p.entry.id,
    )
    expect(ids).toContain('a-eerie')
  })

  it('returns fewer picks when the catalog is small', () => {
    expect(
      recommend({ catalog: catalog.slice(0, 3), profile: eerieFan, events: [] })
        .picks,
    ).toHaveLength(3)
  })
})

describe('shortlist rules', () => {
  const result = recommend({
    catalog,
    profile: { ...eerieFan, ladderLevel: 3 },
    events: [],
  })

  it('returns 6 distinct picks in personal mode', () => {
    expect(result.mode).toBe('personal')
    expect(result.picks).toHaveLength(6)
    expect(new Set(result.picks.map((p) => p.entry.id)).size).toBe(6)
  })

  it('includes a story under 10 minutes even when the reader prefers long ones', () => {
    expect(result.picks.some((p) => p.entry.lengthClass === 'under10')).toBe(
      true,
    )
  })

  it('includes an essay when one scores reasonably', () => {
    expect(result.picks.some((p) => p.entry.form === 'essay')).toBe(true)
  })

  it('leaves out an essay that scores badly', () => {
    const hates = {
      facetBeliefs: {
        ...eerieFan.facetBeliefs,
        'mood:funny': { success: 0, failure: 20 },
        'genre:humour': { success: 0, failure: 20 },
      },
      ladderLevel: 0,
    }
    const ids = recommend({ catalog, profile: hates, events: [] }).picks.map(
      (p) => p.entry.id,
    )
    expect(ids).not.toContain('e-funny-essay')
  })

  it('includes a wildcard from a mood the reader has not picked', () => {
    const wildcard = result.picks.find((p) => p.slots.includes('wildcard'))
    expect(wildcard).toBeDefined()
    expect(wildcard!.entry.moods).not.toContain('eerie')
    expect(wildcard!.reason).toMatch(/^Something different: an? /)
  })

  it('gives every pick a one-line reason, and explains matches by taste', () => {
    for (const pick of result.picks) {
      expect(pick.reason.length).toBeGreaterThan(5)
      expect(pick.reason).not.toContain('\n')
    }
    const match = result.picks.find((p) => p.entry.id === 'a-eerie')
    expect(match?.reason).toBe('Because you like eerie stories')
  })

  it('writes the wildcard reason like "a funny essay"', () => {
    const only = [catalog[0], catalog[4]]
    const r = recommend({ catalog: only, profile: eerieFan, events: [] })
    expect(r.picks.find((p) => p.entry.id === 'e-funny-essay')?.reason).toBe(
      'Something different: a funny essay',
    )
  })

  it('gives the same answer for the same input', () => {
    const again = recommend({
      catalog,
      profile: { ...eerieFan, ladderLevel: 3 },
      events: [],
    })
    expect(again).toEqual(result)
  })
})

describe('starter mix', () => {
  const result = recommend({ catalog, profile: null, events: [] })

  it('is used when there is no profile, or no beliefs yet', () => {
    expect(result.mode).toBe('starter')
    expect(
      recommend({
        catalog,
        profile: { facetBeliefs: {}, ladderLevel: 0 },
        events: [],
      }).mode,
    ).toBe('starter')
  })

  it('has 6 picks with a short story and an essay', () => {
    expect(result.picks).toHaveLength(6)
    expect(result.picks.some((p) => p.entry.lengthClass === 'under10')).toBe(
      true,
    )
    expect(result.picks.some((p) => p.entry.form === 'essay')).toBe(true)
  })

  it('is varied: no two picks share the same moods and genres', () => {
    const keys = result.picks.map((p) =>
      [...p.entry.moods, ...p.entry.genres].join('|'),
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every pick a reason', () => {
    for (const pick of result.picks)
      expect(pick.reason).toMatch(/^A good place to start/)
  })
})
