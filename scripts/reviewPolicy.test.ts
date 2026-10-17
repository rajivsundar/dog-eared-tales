import { describe, expect, it } from 'vitest'
import {
  type BaseEntry,
  type CatalogEntry,
  decideShipping,
  mergeCuration,
} from './build-catalog.ts'
import {
  BANNED_WORDS,
  automatedCheckProblems,
  bannedWordsIn,
  copiedRun,
  frontMatterIn,
} from './curationChecks.ts'

const STORY =
  'On the third of June the old clerk walked slowly down to the harbour and waited for the evening boat to come in.'

function record(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
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
    textUrl: '/texts/pg-1.epub',
    coverUrl: '',
    startHref: 'a#b',
    endHref: 'a#c',
    sha256: '',
    source: '',
    sourceUrl: '',
    license: '',
    year: 1900,
    eraBand: '1900-1930',
    form: 'story',
    genres: ['literary'],
    moods: ['thoughtful'],
    contentNotes: [],
    hook: 'A clerk waits at the harbour for a boat.',
    blurb:
      'An old clerk spends an evening at the harbour, waiting for a boat and thinking about his years at the office.',
    generatedBy: 'claude-code',
    reviewed: false,
    review: 'auto',
    ...changes,
  }
}

describe('the banned words', () => {
  it('are kept in one list, and every one is caught as a whole word in any case', () => {
    expect(BANNED_WORDS.length).toBeGreaterThan(10)
    for (const word of BANNED_WORDS) {
      expect(bannedWordsIn(`It is full of ${word} here.`), word).toContain(word)
      expect(bannedWordsIn(`${word.toUpperCase()}!`), word).toContain(word)
    }
  })

  it('match whole words only', () => {
    expect(bannedWordsIn('A twisting road and a surprised guest.')).toEqual([])
    expect(bannedWordsIn('Ironically, she regrets nothing.')).toEqual([])
    expect(bannedWordsIn('A plot twist, then.')).toEqual(['twist'])
  })

  it('catch "and then" across extra spaces or a line break', () => {
    expect(bannedWordsIn('He waits, and  then leaves.')).toContain('and then')
    expect(bannedWordsIn('He waits and\nthen leaves.')).toContain('and then')
    expect(bannedWordsIn('Then he waits and leaves.')).toEqual([])
  })

  it('include the words the policy names', () => {
    for (const word of [
      'and then',
      'twist',
      'irony',
      'surprise',
      'unexpected',
      'heartbreaking',
      'jealousy',
      'refusal',
      'regret',
    ]) {
      expect(BANNED_WORDS).toContain(word)
    }
  })
})

describe('the six-word check', () => {
  it('finds six words copied from the story, ignoring case and punctuation', () => {
    expect(
      copiedRun(STORY, 'Watch the Old Clerk walked slowly down, always.'),
    ).toBe('the old clerk walked slowly down')
    expect(copiedRun(STORY, 'The old clerk walked slowly to the pier.')).toBe(
      null,
    )
  })

  it('combines with the banned words in the automated check, naming the field', () => {
    const problems = automatedCheckProblems(
      {
        hook: 'A story with a twist.',
        blurb: 'He waited for the evening boat to come in, they say.',
      },
      STORY,
    )
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/^hook uses "twist"/)
    expect(problems[1]).toMatch(/^blurb copies six words/)
  })
})

describe('which records ship', () => {
  it('a record checked by a person ships when it is marked reviewed', () => {
    const { shipped, heldBack } = decideShipping(
      [record('a', { review: 'human', reviewed: true })],
      { a: STORY },
    )
    expect(shipped.map((e) => e.id)).toEqual(['a'])
    expect(heldBack).toEqual([])
  })

  it('a human record that is not reviewed yet does not ship, and is not "held back"', () => {
    const { shipped, heldBack } = decideShipping(
      [record('a', { review: 'human', reviewed: false })],
      { a: STORY },
    )
    expect(shipped).toEqual([])
    expect(heldBack).toEqual([])
  })

  it('an AI-written record ships when every automated check passes, even unreviewed', () => {
    const { shipped, heldBack } = decideShipping(
      [record('a', { review: 'auto', reviewed: false })],
      { a: STORY },
    )
    expect(shipped.map((e) => e.id)).toEqual(['a'])
    expect(heldBack).toEqual([])
  })

  it('an AI-written record with a banned word is held back with its id and the reason, and the rest still ship', () => {
    const { shipped, heldBack } = decideShipping(
      [
        record('good'),
        record('bad', { blurb: 'A clerk waits, and then a surprise.' }),
        record('human', { review: 'human', reviewed: true }),
      ],
      { good: STORY, bad: STORY, human: STORY },
    )
    expect(shipped.map((e) => e.id)).toEqual(['good', 'human'])
    expect(heldBack).toHaveLength(1)
    expect(heldBack[0].id).toBe('bad')
    expect(heldBack[0].reasons.join(' ')).toMatch(
      /blurb uses "and then", "surprise"/,
    )
  })

  it('an AI-written record that copies six words from the story is held back with the reason', () => {
    const { shipped, heldBack } = decideShipping(
      [
        record('copy', {
          hook: 'He walked slowly down to the harbour and waited.',
        }),
      ],
      { copy: STORY },
    )
    expect(shipped).toEqual([])
    expect(heldBack).toEqual([
      {
        id: 'copy',
        reasons: [expect.stringMatching(/^hook copies six words/)],
      },
    ])
  })

  it('applies the banned words to AI-written records only', () => {
    const { shipped } = decideShipping(
      [
        record('human', {
          review: 'human',
          reviewed: true,
          blurb: 'An unexpected visit.',
        }),
      ],
      { human: STORY },
    )
    expect(shipped.map((e) => e.id)).toEqual(['human'])
  })
})

describe('the front-matter check', () => {
  const CREDITS =
    'E-text prepared by Anne Storer and the Project Gutenberg Online Distributed Proofreading Team. THE MAGIC FISHBONE. FOREWORD. There was once a King.'

  it('finds credits, notes and a foreword at the start of a text range', () => {
    expect(frontMatterIn(CREDITS)).toEqual([
      '"E-text prepared by"',
      'a credits line',
      'a foreword',
    ])
    expect(frontMatterIn('Produced by Jane Doe. Chapter one.')).toEqual([
      '"Produced by"',
    ])
    expect(frontMatterIn("Transcriber's Note: spelling kept.")).toEqual([
      'a transcriber note',
    ])
    expect(frontMatterIn("Printer's Note. Chapter one.")).toEqual([
      'a printer note',
    ])
  })

  it('passes a text range that opens with the story', () => {
    expect(frontMatterIn(STORY)).toEqual([])
  })

  it('ignores the same words deep inside the story', () => {
    expect(frontMatterIn(STORY.repeat(60) + ' A foreword.')).toEqual([])
  })

  it('holds back an AI-written record whose text range opens with front matter, with the reason', () => {
    const { shipped, heldBack } = decideShipping(
      [record('fishbone'), record('good')],
      { fishbone: CREDITS, good: STORY },
    )
    expect(shipped.map((e) => e.id)).toEqual(['good'])
    expect(heldBack).toEqual([
      {
        id: 'fishbone',
        reasons: [
          expect.stringMatching(/^the text range opens with front matter/),
        ],
      },
    ])
  })

  it('does not apply to records a person has checked', () => {
    const { shipped } = decideShipping(
      [record('a', { review: 'human', reviewed: true })],
      { a: CREDITS },
    )
    expect(shipped.map((e) => e.id)).toEqual(['a'])
  })
})

describe('schema errors still stop the build', () => {
  const base = (): BaseEntry =>
    ({
      id: 'pg-1-x',
      title: 'X',
      author: 'A',
      wordCount: 2000,
    }) as BaseEntry
  const valid = {
    year: 1900,
    eraBand: '1900-1930',
    form: 'story',
    genres: ['literary'],
    moods: ['thoughtful'],
    contentNotes: [],
    hook: 'A hook.',
    blurb: 'A blurb.',
    generatedBy: 'claude-code',
    reviewed: false,
    review: 'auto',
  }
  const merge = (changes: Record<string, unknown>) =>
    mergeCuration([base()], {
      schemaVersion: 1,
      entries: { 'pg-1-x': { ...valid, ...changes } },
    })

  it('accepts a good AI-written record', () => {
    expect(merge({})[0].review).toBe('auto')
  })

  it('refuses a missing or unknown review value', () => {
    expect(() => merge({ review: undefined })).toThrow(/review must be/)
    expect(() => merge({ review: 'robot' })).toThrow(/review must be/)
  })

  it('refuses a genre or content note outside the approved lists, even for an AI-written record', () => {
    expect(() => merge({ genres: ['cooking'] })).toThrow(
      /not an allowed genres/,
    )
    expect(() => merge({ contentNotes: ['spiders'] })).toThrow(
      /not an allowed contentNotes/,
    )
    expect(
      merge({ contentNotes: ['sexual themes', 'threat to a child'] })[0]
        .contentNotes,
    ).toEqual(['sexual themes', 'threat to a child'])
  })

  it('refuses a hook that is too long', () => {
    expect(() => merge({ hook: 'word '.repeat(21) })).toThrow(/limit is 20/)
  })

  it('sets the reading band by hand when an override and its reason are given', () => {
    const [entry] = mergeCuration(
      [{ ...base(), readingLevel: { grade: 5, band: 'easy' } } as BaseEntry],
      {
        schemaVersion: 1,
        entries: {
          'pg-1-x': {
            ...valid,
            readingLevelOverride: 'medium',
            overrideReason: 'Dense period slang.',
          },
        },
      },
    )
    expect(entry.readingLevel).toEqual({
      grade: 5,
      band: 'medium',
      adjusted: true,
    })
  })

  it('refuses an override that equals the computed band', () => {
    expect(() =>
      mergeCuration(
        [
          {
            ...base(),
            readingLevel: { grade: 7, band: 'medium' },
          } as BaseEntry,
        ],
        {
          schemaVersion: 1,
          entries: {
            'pg-1-x': {
              ...valid,
              readingLevelOverride: 'medium',
              overrideReason: 'Not needed.',
            },
          },
        },
      ),
    ).toThrow(/computed band already/)
  })

  it('leaves the computed reading level alone without an override', () => {
    const [entry] = mergeCuration(
      [{ ...base(), readingLevel: { grade: 5, band: 'easy' } } as BaseEntry],
      { schemaVersion: 1, entries: { 'pg-1-x': valid } },
    )
    expect(entry.readingLevel).toEqual({ grade: 5, band: 'easy' })
  })

  it('refuses an override with no reason, a blank reason, an unknown band, or a reason alone', () => {
    expect(() => merge({ readingLevelOverride: 'medium' })).toThrow(
      /needs an overrideReason/,
    )
    expect(() =>
      merge({ readingLevelOverride: 'medium', overrideReason: '  ' }),
    ).toThrow(/needs an overrideReason/)
    expect(() =>
      merge({ readingLevelOverride: 'hard', overrideReason: 'x' }),
    ).toThrow(/readingLevelOverride must be/)
    expect(() => merge({ overrideReason: 'x' })).toThrow(
      /readingLevelOverride must be/,
    )
  })
})
