import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { ReaderEvent } from '../../stores'
import {
  isLongNightsTale,
  rankLongNights,
  recommendLongNights,
} from './longNights'

function entry(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    title: `Title ${id}`,
    author: 'A',
    language: 'en',
    bookTitle: id,
    isCollection: false,
    wordCount: 3000,
    readingMinutes: 13,
    lengthClass: '10to30',
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

let tick = 0
const ev = (workId: string, type: ReaderEvent['type']): ReaderEvent => ({
  id: `e${tick}`,
  workId,
  type,
  at: tick++,
})

describe('which works are Tales for Longer Nights', () => {
  it('takes fiction that is eerie, a ghost story or horror', () => {
    expect(isLongNightsTale(entry('a', { moods: ['eerie'] }))).toBe(true)
    expect(isLongNightsTale(entry('b', { genres: ['ghost story'] }))).toBe(true)
    expect(isLongNightsTale(entry('c', { genres: ['horror'] }))).toBe(true)
    expect(
      isLongNightsTale(entry('d', { form: 'novella', moods: ['eerie'] })),
    ).toBe(true)
    expect(
      isLongNightsTale(entry('e', { form: 'novelette', genres: ['horror'] })),
    ).toBe(true)
  })

  it('never takes an essay, however dark', () => {
    expect(
      isLongNightsTale(entry('a', { form: 'essay', moods: ['eerie', 'dark'] })),
    ).toBe(false)
    expect(
      isLongNightsTale(
        entry('modest-proposal', {
          form: 'essay',
          genres: ['satire', 'social criticism'],
          moods: ['dark'],
        }),
      ),
    ).toBe(false)
  })

  it('counts "dark" only alongside horror or mystery', () => {
    expect(isLongNightsTale(entry('a', { moods: ['dark'] }))).toBe(false)
    expect(
      isLongNightsTale(
        entry('b', { moods: ['dark'], genres: ['satire', 'literary'] }),
      ),
    ).toBe(false)
    expect(
      isLongNightsTale(entry('c', { moods: ['dark'], genres: ['mystery'] })),
    ).toBe(true)
    expect(
      isLongNightsTale(entry('d', { moods: ['dark'], genres: ['horror'] })),
    ).toBe(true)
  })

  it('leaves out plain fiction', () => {
    expect(isLongNightsTale(entry('a'))).toBe(false)
  })
})

describe('the row', () => {
  const eerie = (id: string, extra: Partial<CatalogEntry> = {}) =>
    entry(id, { moods: ['eerie'], ...extra })
  const usher = eerie('usher', { genres: ['horror'] })
  const profile = { facetBeliefs: {} }

  it('holds up to 6 tales', () => {
    const catalog = Array.from({ length: 10 }, (_, i) => eerie(`t${i}`))
    expect(recommendLongNights({ catalog, profile, events: [] })).toHaveLength(
      6,
    )
  })

  it('leaves out finished works and works marked Not for me', () => {
    const catalog = [eerie('a'), eerie('b'), eerie('c')]
    const picks = rankLongNights({
      catalog,
      profile,
      events: [ev('a', 'finished'), ev('b', 'notForMe')],
    })
    expect(picks.map((p) => p.entry.id)).toEqual(['c'])
  })

  it('brings a work back after Not for me is undone', () => {
    const catalog = [eerie('a'), eerie('b')]
    const picks = rankLongNights({
      catalog,
      profile,
      events: [ev('a', 'notForMe'), ev('a', 'undo')],
    })
    expect(picks.map((p) => p.entry.id)).toEqual(['a', 'b'])
  })

  it('puts the featured story first with its reason, if it is not finished', () => {
    const catalog = [eerie('a'), eerie('b'), usher]
    const picks = rankLongNights({
      catalog,
      profile,
      events: [],
      featuredId: 'usher',
      featuredReason: "This fall's best-named story",
    })
    expect(picks[0].entry.id).toBe('usher')
    expect(picks[0].reason).toBe("This fall's best-named story")
    expect(picks[1].reason).not.toBe("This fall's best-named story")
  })

  it('drops the featured story once it is finished', () => {
    const picks = rankLongNights({
      catalog: [eerie('a'), usher],
      profile,
      events: [ev('usher', 'finished')],
      featuredId: 'usher',
      featuredReason: 'x',
    })
    expect(picks.map((p) => p.entry.id)).toEqual(['a'])
  })

  it('ranks by the reader’s learned weights', () => {
    const catalog = [
      entry('ghost', { genres: ['ghost story'], moods: ['melancholy'] }),
      entry('horror', { genres: ['horror'], moods: ['tense'] }),
    ]
    const likesHorror = {
      facetBeliefs: {
        'genre:horror': { success: 6, failure: 0 },
        'mood:tense': { success: 6, failure: 0 },
      },
    }
    expect(
      rankLongNights({ catalog, profile: likesHorror, events: [] })[0].entry.id,
    ).toBe('horror')
    const likesGhosts = {
      facetBeliefs: {
        'genre:ghost story': { success: 6, failure: 0 },
        'mood:melancholy': { success: 6, failure: 0 },
      },
    }
    expect(
      rankLongNights({ catalog, profile: likesGhosts, events: [] })[0].entry.id,
    ).toBe('ghost')
  })
})
