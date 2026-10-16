import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import type { ReaderEvent, ReaderEventType } from '../../stores'
import { firstShortlist } from './firstShortlist'
import { ONBOARD_START, ONBOARD_WORK, buildProfile, netWeight } from './learn'
import { pickTasteCards } from './tasteCards'

const NOW = Date.UTC(2026, 9, 16, 12)
const MOODS = [
  'cozy',
  'eerie',
  'funny',
  'romantic',
  'thoughtful',
  'adventurous',
  'melancholy',
  'uplifting',
  'tense',
  'whimsical',
  'dark',
  'hopeful',
]
const GENRES = [
  'horror',
  'mystery',
  'romance',
  'satire',
  'literary',
  'adventure',
]

function entry(i: number): CatalogEntry {
  const id = `c${String(i).padStart(2, '0')}`
  return {
    id,
    title: `Work ${id}`,
    author: 'A',
    language: 'en',
    bookTitle: id,
    isCollection: false,
    wordCount: 2000,
    readingMinutes: 8,
    lengthClass: i % 3 === 0 ? 'under10' : '10to30',
    readingLevel: { grade: 6, band: 'easy' },
    firstLine: `First line of ${id}.`,
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
    form: i === 5 || i === 17 ? 'essay' : 'story',
    genres: [GENRES[i % GENRES.length]],
    moods: [MOODS[i % 12], MOODS[(i + 5) % 12]],
    contentNotes: [],
    hook: '',
    blurb: '',
    generatedBy: 'claude-code',
    reviewed: true,
  } as CatalogEntry
}
const catalog = Array.from({ length: 24 }, (_, i) => entry(i))

let tick = 0
function onboard(workId: string, reason: string): ReaderEvent {
  tick++
  return {
    id: `o${tick}`,
    workId,
    type: 'onboard' as ReaderEventType,
    reason,
    at: NOW - 100000 + tick,
  }
}
const start = () => onboard(ONBOARD_WORK, ONBOARD_START)

describe('onboarding counts less than real reading', () => {
  const w = (events: ReaderEvent[]) =>
    buildProfile(catalog, events, NOW).facetBeliefs

  it('a picked mood is +1', () => {
    const events = [start(), onboard(ONBOARD_WORK, 'mood:eerie')]
    expect(netWeight(w(events), 'mood:eerie')).toBeCloseTo(1, 2)
  })

  it('Love is +1.5, Maybe +0.25 and Not for me -1.5 on the work’s moods, genres and length', () => {
    const e = catalog[1]
    for (const [answer, push] of [
      ['love', 1.5],
      ['maybe', 0.25],
      ['notForMe', -1.5],
    ] as const) {
      const beliefs = w([start(), onboard(e.id, answer)])
      expect(netWeight(beliefs, `mood:${e.moods[0]}`), answer).toBeCloseTo(
        push,
        2,
      )
      expect(netWeight(beliefs, `genre:${e.genres[0]}`), answer).toBeCloseTo(
        push,
        2,
      )
      expect(netWeight(beliefs, `length:${e.lengthClass}`), answer).toBeCloseTo(
        push,
        2,
      )
    }
  })

  it('only the newest onboarding run counts', () => {
    const events = [
      start(),
      onboard(ONBOARD_WORK, 'mood:eerie'),
      start(),
      onboard(ONBOARD_WORK, 'mood:cozy'),
    ]
    const beliefs = w(events)
    expect(netWeight(beliefs, 'mood:cozy')).toBeCloseTo(1, 2)
    expect(netWeight(beliefs, 'mood:eerie')).toBe(0)
  })

  it('a run with no answers (Skip setup) gives no taste at all', () => {
    expect(w([start(), onboard(ONBOARD_WORK, 'mood:eerie'), start()])).toEqual(
      {},
    )
  })
})

describe('pickTasteCards', () => {
  const eerieCozy = pickTasteCards(catalog, ['eerie', 'cozy', 'funny'])

  it('gives 8 different works, with at least one essay and one under 10 minutes', () => {
    expect(eerieCozy).toHaveLength(8)
    expect(new Set(eerieCozy.map((e) => e.id)).size).toBe(8)
    expect(eerieCozy.some((e) => e.form === 'essay')).toBe(true)
    expect(eerieCozy.some((e) => e.lengthClass === 'under10')).toBe(true)
  })

  it('draws from the chosen moods, one work each, and from other moods too', () => {
    for (const mood of ['eerie', 'cozy', 'funny']) {
      expect(
        eerieCozy.some((e) => e.moods.includes(mood)),
        mood,
      ).toBe(true)
    }
    expect(
      eerieCozy.some(
        (e) => !e.moods.some((m) => ['eerie', 'cozy', 'funny'].includes(m)),
      ),
    ).toBe(true)
  })

  it('spreads across different moods', () => {
    const firstMoods = eerieCozy.map((e) => e.moods[0])
    expect(new Set(firstMoods).size).toBeGreaterThanOrEqual(6)
  })

  it('always gives the same cards for the same moods', () => {
    expect(pickTasteCards(catalog, ['eerie', 'cozy', 'funny'])).toEqual(
      eerieCozy,
    )
  })

  it('still has an essay and a short work when the chosen moods have none', () => {
    const cards = pickTasteCards(catalog, ['eerie', 'tense'])
    expect(cards.some((e) => e.form === 'essay')).toBe(true)
    expect(cards.some((e) => e.lengthClass === 'under10')).toBe(true)
    expect(cards).toHaveLength(8)
  })

  it('with no moods (skipped) draws the balanced starter mix', () => {
    const cards = pickTasteCards(catalog, [])
    expect(cards).toHaveLength(8)
    expect(cards.some((e) => e.form === 'essay')).toBe(true)
    expect(cards.some((e) => e.lengthClass === 'under10')).toBe(true)
    // The starter mix is varied.
    expect(new Set(cards.map((e) => e.moods[0])).size).toBeGreaterThanOrEqual(5)
  })
})

describe('the first shortlist', () => {
  const answers = (loved: string[], notForMe: string[]) => [
    start(),
    ...loved.map((id) => onboard(id, 'love')),
    ...notForMe.map((id) => onboard(id, 'notForMe')),
  ]
  const build = (
    loved: string[],
    avoid: string[],
    moods: string[] = ['eerie'],
  ) => {
    const events = [
      ...answers(loved, avoid),
      ...moods.map((m) => onboard(ONBOARD_WORK, `mood:${m}`)),
    ]
    const profile = buildProfile(catalog, events, NOW)
    return firstShortlist({ catalog, profile, events, avoid, loved })
  }

  it('leaves out works answered Not for me', () => {
    // c01 and c06 are the strongest eerie matches, so they would otherwise lead the list.
    const without = build([], [])
    const target = without[0].entry.id
    const withAvoid = build([], [target])
    expect(withAvoid.map((p) => p.entry.id)).not.toContain(target)
    expect(withAvoid).toHaveLength(6)
  })

  it('holds a Loved card even when it would not make the list by score', () => {
    const plain = build([], [], ['eerie'])
    const outsider = catalog.find(
      (e) =>
        !e.moods.includes('eerie') &&
        !plain.some((p) => p.entry.id === e.id) &&
        e.lengthClass === '10to30' &&
        e.form === 'story',
    )!
    const list = build([outsider.id], [], ['eerie'])
    expect(list.map((p) => p.entry.id)).toContain(outsider.id)
    expect(list).toHaveLength(6)
    // The slots (a wildcard, an essay, a short story) are still there.
    expect(list.some((p) => p.slots.includes('wildcard'))).toBe(true)
    expect(list.some((p) => p.entry.form === 'essay')).toBe(true)
    expect(list.some((p) => p.entry.lengthClass === 'under10')).toBe(true)
  })

  it('does not change a list that already holds a Loved card', () => {
    const base = build([], [])
    const lovedAlready = base[0].entry.id
    const list = build([lovedAlready], [])
    expect(list.map((p) => p.entry.id)).toContain(lovedAlready)
  })

  it('works in the starter mix too (no moods picked, a card Loved)', () => {
    const events = [start(), onboard('c07', 'love')]
    const profile = buildProfile(catalog, events, NOW)
    const list = firstShortlist({
      catalog,
      profile,
      events,
      avoid: [],
      loved: ['c07'],
    })
    expect(list.map((p) => p.entry.id)).toContain('c07')
  })
})
