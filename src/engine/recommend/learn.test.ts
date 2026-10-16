import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { ReaderEvent, ReaderEventType } from '../../stores'
import {
  HALF_LIFE_DAYS,
  PUSH,
  WEIGHT_MAX,
  WEIGHT_MIN,
  buildProfile,
  netWeight,
  ratingOf,
  topFacets,
} from './learn'
import { recommend } from './recommend'
import { scoreEntry } from './score'
import { digestEvents } from './history'
import { whyThisPick } from './why'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 16, 12)

function entry(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    title: id,
    author: 'A',
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
    startHref: 'a#b',
    endHref: 'a#c',
    sha256: '',
    source: '',
    sourceUrl: '',
    license: '',
    year: 1900,
    eraBand: '1850-1899',
    form: 'story',
    genres: ['horror'],
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
  return { id: `e${tick}`, workId, type, at: NOW - 1000 + tick, ...extra }
}

const story = entry('s1', {
  moods: ['eerie', 'tense'],
  genres: ['horror'],
  lengthClass: '10to30',
})
const catalog = [story]
const weights = (events: ReaderEvent[], now = NOW) =>
  buildProfile(catalog, events, now).facetBeliefs
const net = (events: ReaderEvent[], key = 'mood:eerie', now = NOW) =>
  netWeight(weights(events, now), key)

describe('what each thing pushes', () => {
  it('finishing always gives +1 to the story’s moods, genres and length', () => {
    const w = weights([ev('s1', 'finished')])
    for (const key of [
      'mood:eerie',
      'mood:tense',
      'genre:horror',
      'length:10to30',
    ]) {
      expect(netWeight(w, key), key).toBeCloseTo(1, 2)
    }
  })

  it('Loved it adds +2 on top: +3 in all', () => {
    expect(net([ev('s1', 'finished'), ev('s1', 'love')])).toBeCloseTo(3, 2)
  })

  it('It was OK adds nothing on top: +1 in all', () => {
    expect(net([ev('s1', 'finished'), ev('s1', 'ok')])).toBeCloseTo(1, 2)
  })

  it('Not for me after finishing adds -2: -1 in all', () => {
    const w = weights([ev('s1', 'finished'), ev('s1', 'notForMe')])
    for (const key of ['mood:eerie', 'genre:horror', 'length:10to30']) {
      expect(netWeight(w, key), key).toBeCloseTo(-1, 2)
    }
  })

  it('Not for me straight from the shortlist is -2', () => {
    expect(net([ev('s1', 'notForMe')])).toBeCloseTo(-2, 2)
  })

  it('a Dog-ear is +0.75, and un-dog-ear cancels it', () => {
    expect(net([ev('s1', 'save')])).toBeCloseTo(0.75, 2)
    expect(net([ev('s1', 'save'), ev('s1', 'unsave')])).toBe(0)
    // Undo of the un-dog-ear brings it back.
    expect(
      net([
        ev('s1', 'save'),
        ev('s1', 'unsave'),
        ev('s1', 'undo', { reason: 'unsave' }),
      ]),
    ).toBeCloseTo(0.75, 2)
  })

  it('stopping is a mild negative (-0.5), and finishing later cancels it', () => {
    expect(net([ev('s1', 'stopped')])).toBeCloseTo(-0.5, 2)
    expect(net([ev('s1', 'stopped'), ev('s1', 'finished')])).toBeCloseTo(1, 2)
  })

  it('an undo of Not for me removes its push', () => {
    expect(net([ev('s1', 'notForMe'), ev('s1', 'undo')])).toBe(0)
  })

  it('a later rating replaces an earlier one', () => {
    const events = [
      ev('s1', 'finished'),
      ev('s1', 'notForMe'),
      ev('s1', 'love'),
    ]
    expect(net(events)).toBeCloseTo(3, 2)
    expect(ratingOf(events, 's1')).toBe('love')
    expect(ratingOf([], 's1')).toBeUndefined()
  })

  it('the pushes are the ones agreed', () => {
    expect(PUSH).toMatchObject({
      finished: 1,
      love: 2,
      ok: 0,
      notForMe: -2,
      save: 0.75,
    })
  })
})

describe('Not for me reasons', () => {
  const finishedNotForMe = (reason: string) => [
    ev('s1', 'finished'),
    ev('s1', 'notForMe', { reason }),
  ]

  it('"too long" lowers only the length', () => {
    const w = weights(finishedNotForMe('too-long'))
    expect(netWeight(w, 'length:10to30')).toBeCloseTo(-1, 2)
    expect(netWeight(w, 'mood:eerie')).toBeCloseTo(1, 2)
    expect(netWeight(w, 'genre:horror')).toBeCloseTo(1, 2)
  })

  it('"not my genre" lowers only the genres', () => {
    const w = weights(finishedNotForMe('not-my-genre'))
    expect(netWeight(w, 'genre:horror')).toBeCloseTo(-1, 2)
    expect(netWeight(w, 'mood:eerie')).toBeCloseTo(1, 2)
  })

  it('"too dark" lowers the mood dark, and nudges the story’s other moods', () => {
    const w = weights(finishedNotForMe('too-dark'))
    expect(netWeight(w, 'mood:dark')).toBeCloseTo(-2, 2)
    expect(netWeight(w, 'mood:eerie')).toBeCloseTo(0.5, 2)
  })

  it('"already read" says nothing about taste', () => {
    expect(weights([ev('s1', 'notForMe', { reason: 'already-read' })])).toEqual(
      {},
    )
  })
})

describe('ageing, the clamp and reset', () => {
  it('an event counts half as much after 60 days', () => {
    const e = [ev('s1', 'love')]
    const fresh = net(e)
    expect(net(e, 'mood:eerie', NOW + HALF_LIFE_DAYS * DAY)).toBeCloseTo(
      fresh / 2,
      1,
    )
    expect(net(e, 'mood:eerie', NOW + 2 * HALF_LIFE_DAYS * DAY)).toBeCloseTo(
      fresh / 4,
      1,
    )
  })

  it('stops at +8 however many good things happen', () => {
    const many = Array.from({ length: 10 }, () => [
      ev('s1', 'finished'),
      ev('s1', 'love'),
    ]).flat()
    // One story counts once, so spread it over many stories with the same mood.
    const cat = Array.from({ length: 10 }, (_, i) => entry(`m${i}`))
    const events = cat.flatMap((c) => [ev(c.id, 'finished'), ev(c.id, 'love')])
    const w = buildProfile(cat, events, NOW).facetBeliefs
    expect(netWeight(w, 'mood:eerie')).toBe(WEIGHT_MAX)
    expect(many.length).toBeGreaterThan(0)
  })

  it('stops at -5 however many bad things happen', () => {
    const cat = Array.from({ length: 10 }, (_, i) => entry(`m${i}`))
    const events = cat.map((c) => ev(c.id, 'notForMe'))
    const w = buildProfile(cat, events, NOW).facetBeliefs
    expect(netWeight(w, 'mood:eerie')).toBe(WEIGHT_MIN)
    expect(w['mood:eerie']).toEqual({ success: 0, failure: 5 })
  })

  it('clamps after ageing, not before', () => {
    // 10 stories x +3 = 30 now. After 60 days that is 15, still above the cap.
    const cat = Array.from({ length: 10 }, (_, i) => entry(`m${i}`))
    const events = cat.flatMap((c) => [ev(c.id, 'finished'), ev(c.id, 'love')])
    const later = NOW + HALF_LIFE_DAYS * DAY
    expect(
      netWeight(buildProfile(cat, events, later).facetBeliefs, 'mood:eerie'),
    ).toBe(WEIGHT_MAX)
    // After 240 days it is 30 / 16 = 1.9, below the cap, and is not clamped up.
    const muchLater = NOW + 4 * HALF_LIFE_DAYS * DAY
    expect(
      netWeight(
        buildProfile(cat, events, muchLater).facetBeliefs,
        'mood:eerie',
      ),
    ).toBeCloseTo(30 / 16, 1)
  })

  it('a taste reset makes earlier events count for nothing', () => {
    const events = [ev('s1', 'finished'), ev('s1', 'love')]
    const reset = ev('taste', 'reset')
    expect(weights([...events, reset])).toEqual({})
    const after = ev('s1', 'finished')
    expect(
      netWeight(weights([...events, reset, after]), 'mood:eerie'),
    ).toBeCloseTo(1, 2)
  })

  it('lists the top moods and genres the reader likes', () => {
    const w = weights([ev('s1', 'finished'), ev('s1', 'love')])
    expect(topFacets(w, 'mood').map((f) => f.name)).toEqual(['eerie', 'tense'])
    expect(topFacets(w, 'genre').map((f) => f.name)).toEqual(['horror'])
    expect(topFacets({}, 'mood')).toEqual([])
  })
})

describe('learning changes the picks', () => {
  const mood = (i: number) => ['eerie', 'cozy', 'funny'][i % 3]
  const cat = Array.from({ length: 15 }, (_, i) =>
    entry(`t${String(i).padStart(2, '0')}`, {
      moods: [mood(i)],
      genres: [['horror', 'romance', 'humour'][i % 3]],
      lengthClass: i % 2 === 0 ? 'under10' : '60plus',
    }),
  )
  const eerieCount = (events: ReaderEvent[]) => {
    const profile = buildProfile(cat, events, NOW)
    const picks = recommend({ catalog: cat, profile, events }).picks
    return picks.filter((p) => p.entry.moods.includes('eerie')).length
  }

  it('Loved it on an eerie story raises eerie picks for the next day', () => {
    const before = eerieCount([])
    const events = [ev('t00', 'finished'), ev('t00', 'love')]
    const after = eerieCount(events)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeGreaterThanOrEqual(3)
  })

  it('"too long" lowers long picks', () => {
    // Three finished long stories, each rated Not for me: too long.
    const long = cat.filter((c) => c.lengthClass === '60plus').slice(0, 3)
    const events = long.flatMap((c) => [
      ev(c.id, 'finished'),
      ev(c.id, 'notForMe', { reason: 'too-long' }),
    ])
    const profile = buildProfile(cat, events, NOW)
    expect(netWeight(profile.facetBeliefs, 'length:60plus')).toBeCloseTo(-3, 1)

    const history = digestEvents(events)
    const other = cat.filter((c) => c.lengthClass === '60plus')[4]
    // The length part of an untouched long story's score goes down...
    const lengthPart = (beliefs: typeof profile.facetBeliefs, e = other) =>
      scoreEntry(e, { beliefs, preferred: '60plus', history }).parts.length
    expect(lengthPart(profile.facetBeliefs)).toBeLessThan(lengthPart({}))
    // ...and a short story's length part is not held back by it.
    const short = cat[0]
    expect(lengthPart(profile.facetBeliefs, short)).toBeGreaterThanOrEqual(
      lengthPart({}, short) * 0.99,
    )
  })
})

describe('the wildcard', () => {
  const darkStories = Array.from({ length: 8 }, (_, i) =>
    entry(`d${i}`, { moods: ['dark'], genres: ['horror'] }),
  )
  const others = [
    entry('c0', { moods: ['cozy'], genres: ['romance'] }),
    entry('c1', { moods: ['cozy'], genres: ['romance'] }),
    entry('c2', { moods: ['cozy'], genres: ['romance'] }),
  ]
  const cat = [...darkStories, ...others]

  it('still appears after several "too dark" ratings', () => {
    const events = darkStories
      .slice(0, 6)
      .flatMap((c) => [
        ev(c.id, 'finished'),
        ev(c.id, 'notForMe', { reason: 'too-dark' }),
      ])
    const profile = buildProfile(cat, events, NOW)
    expect(netWeight(profile.facetBeliefs, 'mood:dark')).toBe(WEIGHT_MIN)

    const picks = recommend({ catalog: cat, profile, events }).picks
    const wildcard = picks.find((p) => p.slots.includes('wildcard'))
    expect(wildcard).toBeDefined()
    expect(wildcard!.reason).toMatch(/^Something different: /)
    // Works the reader rated Not for me are still never offered.
    const rated = new Set(darkStories.slice(0, 6).map((c) => c.id))
    expect(picks.every((p) => !rated.has(p.entry.id))).toBe(true)
  })

  it('ignores negative mood weights when choosing, so a disliked mood does not rank it last', () => {
    const beliefs = {
      'mood:cozy': { success: 5, failure: 0 },
      'mood:dark': { success: 0, failure: 5 },
    }
    const small = [
      entry('a-dark', { moods: ['dark'], genres: ['horror'] }),
      entry('b-funny', { moods: ['funny'], genres: ['horror'] }),
      entry('z-cozy', { moods: ['cozy'], genres: ['romance'] }),
    ]
    const picks = recommend({
      catalog: small,
      profile: { facetBeliefs: beliefs, ladderLevel: 0 },
      events: [],
      count: 3,
    }).picks
    const wildcard = picks.find((p) => p.slots.includes('wildcard'))
    // Treated as neutral, the dark story ties with the funny one, and the tie goes to the lower id.
    expect(wildcard?.entry.id).toBe('a-dark')
  })

  it('still skips a work that was individually excluded', () => {
    const events = [ev('a-dark', 'notForMe')]
    const small = [
      entry('a-dark', { moods: ['dark'] }),
      entry('b-funny', { moods: ['funny'] }),
      entry('z-cozy', { moods: ['cozy'] }),
    ]
    const picks = recommend({
      catalog: small,
      profile: {
        facetBeliefs: { 'mood:cozy': { success: 5, failure: 0 } },
        ladderLevel: 0,
      },
      events,
      count: 3,
    }).picks
    expect(picks.map((p) => p.entry.id)).not.toContain('a-dark')
    expect(picks.find((p) => p.slots.includes('wildcard'))?.entry.id).toBe(
      'b-funny',
    )
  })
})

describe('Why this pick?', () => {
  const eerie = entry('x', {
    moods: ['eerie'],
    genres: ['horror'],
    lengthClass: '10to30',
  })
  const likes = {
    'mood:eerie': { success: 3, failure: 0 },
    'genre:horror': { success: 1, failure: 0 },
  }

  it('names the moods and genres the reader likes', () => {
    expect(whyThisPick(eerie, 'Because you like eerie stories', likes)).toBe(
      'It matches what you like: eerie and horror.',
    )
    expect(
      whyThisPick(eerie, 'Because you like eerie stories', {
        ...likes,
        'length:10to30': { success: 2, failure: 0 },
      }),
    ).toContain('reads of this length')
  })

  it('explains the wildcard and the starter mix', () => {
    expect(
      whyThisPick(eerie, 'Something different: an eerie story', {}),
    ).toMatch(/wildcard/)
    expect(
      whyThisPick(eerie, 'A good place to start: an eerie story', {}),
    ).toMatch(/starter/)
  })

  it('says something sensible when nothing matches', () => {
    expect(whyThisPick(eerie, 'Quick to read: 8 minutes', {})).toMatch(
      /rounds out/,
    )
  })
})
