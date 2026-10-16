import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import { longListReason } from './longList'
import { personalReason, starterReason, wildcardReason } from './reasons'
import { genrePlural, genreSingular, moodPlural, moodSingular } from './wording'
import { whyThisPick } from './why'

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
  'ghost story',
  'satire',
  'humour',
  'romance',
  'adventure',
  'science fiction',
  'literary',
  'philosophy',
  'social criticism',
  'politics',
  'history',
  'memoir',
  'spirituality',
  'self-help',
  'science',
  'war',
  'fantasy',
]

function entry(changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'x',
    title: 'Title',
    form: 'story',
    moods: ['eerie'],
    genres: ['literary'],
    readingMinutes: 8,
    lengthClass: 'under10',
    ...changes,
  } as CatalogEntry
}
const likes = (key: string) => ({ [key]: { success: 4, failure: 0 } })

describe('genre wording', () => {
  it('gives every genre a noun in the plural', () => {
    expect(Object.fromEntries(GENRES.map((g) => [g, genrePlural(g)]))).toEqual({
      horror: 'horror stories',
      mystery: 'mystery stories',
      'ghost story': 'ghost stories',
      satire: 'satire',
      humour: 'humour',
      romance: 'romance',
      adventure: 'adventure stories',
      'science fiction': 'science fiction stories',
      literary: 'literary stories',
      philosophy: 'philosophy',
      'social criticism': 'social criticism',
      politics: 'politics',
      history: 'history',
      memoir: 'memoir',
      spirituality: 'spirituality',
      'self-help': 'self-help',
      science: 'science',
      war: 'war stories',
      fantasy: 'fantasy stories',
    })
  })

  it('names essays as essays, for every genre', () => {
    for (const genre of GENRES) {
      expect(genrePlural(genre, 'essay'), genre).toBe(`${genre} essays`)
      expect(genreSingular(genre, 'essay'), genre).toBe(`${genre} essay`)
    }
    expect(genrePlural('philosophy', 'essay')).toBe('philosophy essays')
  })

  it('gives every genre a noun in the singular', () => {
    expect(
      Object.fromEntries(GENRES.map((g) => [g, genreSingular(g)])),
    ).toEqual({
      horror: 'horror story',
      mystery: 'mystery story',
      'ghost story': 'ghost story',
      satire: 'satire',
      humour: 'humorous story',
      romance: 'romance',
      adventure: 'adventure story',
      'science fiction': 'science fiction story',
      literary: 'literary story',
      philosophy: 'philosophical work',
      'social criticism': 'work of social criticism',
      politics: 'political work',
      history: 'work of history',
      memoir: 'memoir',
      spirituality: 'spiritual work',
      'self-help': 'self-help book',
      science: 'science writing',
      war: 'war story',
      fantasy: 'fantasy story',
    })
  })

  it('never leaves a bare adjective: every phrase has a noun', () => {
    const nouns =
      /(stories|story|essays|essay|satire|humour|romance|philosophy|social criticism|politics|history|memoir|spirituality|self-help|science|work|book|writing)\b/
    for (const genre of GENRES) {
      for (const form of ['story', 'novelette', 'novella', 'essay'] as const) {
        expect(genrePlural(genre, form), `${genre}/${form}`).toMatch(nouns)
        expect(genreSingular(genre, form), `${genre}/${form}`).toMatch(nouns)
      }
    }
  })
})

describe('mood wording', () => {
  it('puts a noun after every mood', () => {
    for (const mood of MOODS) {
      expect(moodPlural(mood), mood).toBe(`${mood} stories`)
      expect(moodSingular(mood), mood).toBe(`${mood} story`)
      expect(moodPlural(mood, 'essay'), mood).toBe(`${mood} essays`)
      expect(moodSingular(mood, 'essay'), mood).toBe(`${mood} essay`)
    }
  })
})

describe('"Because you like …" reasons', () => {
  const reason = (e: CatalogEntry, key: string) =>
    personalReason(e, likes(key), ['match'])

  it('names a noun for every genre', () => {
    const expected: Record<string, string> = {
      horror: 'horror stories',
      mystery: 'mystery stories',
      'ghost story': 'ghost stories',
      satire: 'satire',
      humour: 'humour',
      romance: 'romance',
      adventure: 'adventure stories',
      'science fiction': 'science fiction stories',
      literary: 'literary stories',
      philosophy: 'philosophy',
      'social criticism': 'social criticism',
      politics: 'politics',
      history: 'history',
      memoir: 'memoir',
      spirituality: 'spirituality',
      'self-help': 'self-help',
      science: 'science',
      war: 'war stories',
      fantasy: 'fantasy stories',
    }
    for (const genre of GENRES) {
      const e = entry({ genres: [genre], moods: ['eerie'] })
      expect(reason(e, `genre:${genre}`), genre).toBe(
        `Because you like ${expected[genre]}`,
      )
    }
    expect(reason(entry({ genres: ['literary'] }), 'genre:literary')).toBe(
      'Because you like literary stories',
    )
  })

  it('says "essays" for an essay: "philosophy essays", "thoughtful essays"', () => {
    const essay = entry({
      form: 'essay',
      genres: ['philosophy'],
      moods: ['thoughtful'],
    })
    expect(reason(essay, 'genre:philosophy')).toBe(
      'Because you like philosophy essays',
    )
    expect(reason(essay, 'mood:thoughtful')).toBe(
      'Because you like thoughtful essays',
    )
  })

  it('names a noun for every mood', () => {
    for (const mood of MOODS) {
      const e = entry({ moods: [mood], genres: ['literary'] })
      expect(reason(e, `mood:${mood}`), mood).toBe(
        `Because you like ${mood} stories`,
      )
    }
  })
})

describe('other reason lines', () => {
  it('wildcard and starter lines name the form', () => {
    expect(wildcardReason(entry({ form: 'essay', moods: ['funny'] }), {})).toBe(
      'Something different: a funny essay',
    )
    expect(
      wildcardReason(entry({ form: 'novella', moods: ['eerie'] }), {}),
    ).toBe('Something different: an eerie novella')
    expect(starterReason(entry({ moods: ['cozy'] }))).toBe(
      'A good place to start: a cozy story',
    )
  })

  it('Long List lines name a noun for every genre', () => {
    const rated = entry({
      id: 'r',
      title: 'The Signal-Man',
      genres: [...GENRES],
      moods: [...MOODS],
    })
    const events = [
      { id: '1', workId: 'r', type: 'finished', at: 1 },
      { id: '2', workId: 'r', type: 'love', at: 2 },
    ] as never
    const expected: Record<string, string> = {
      horror: 'horror story',
      mystery: 'mystery story',
      'ghost story': 'ghost story',
      satire: 'satire',
      humour: 'humorous story',
      romance: 'romance',
      adventure: 'adventure story',
      'science fiction': 'science fiction story',
      literary: 'literary story',
      philosophy: 'philosophical work',
      'social criticism': 'work of social criticism',
      politics: 'political work',
      history: 'work of history',
      memoir: 'memoir',
      spirituality: 'spiritual work',
      'self-help': 'self-help book',
      science: 'science writing',
      war: 'war story',
      fantasy: 'fantasy story',
    }
    for (const genre of GENRES) {
      const pick = entry({
        id: 'p',
        form: 'novella',
        genres: [genre],
        moods: [],
      })
      expect(longListReason(pick, [rated, pick], events, {}), genre).toBe(
        `You loved The Signal-Man — try a longer ${expected[genre]}`,
      )
    }
    const byMood = entry({
      id: 'p',
      form: 'novella',
      genres: [],
      moods: ['eerie'],
    })
    expect(longListReason(byMood, [rated, byMood], events, {})).toBe(
      'You loved The Signal-Man — try a longer eerie story',
    )
  })

  it('"Why this pick?" names nouns too', () => {
    const e = entry({
      form: 'essay',
      genres: ['philosophy'],
      moods: ['thoughtful'],
    })
    expect(
      whyThisPick(e, 'Because you like philosophy essays', {
        ...likes('genre:philosophy'),
        ...likes('mood:thoughtful'),
      }),
    ).toBe('It matches what you like: thoughtful essays and philosophy essays.')
  })
})
