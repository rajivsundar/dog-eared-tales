import { describe, expect, it } from 'vitest'
import {
  RETRY_DELAYS_MS,
  analysisPrompt,
  fetchWithRetries,
  firstThird,
  parseModelJson,
  readAnalysis,
} from './guide.ts'

const paragraph = (word: string, count: number): string =>
  Array.from({ length: count }, (_, i) => `${word}${i}`).join(' ')

describe('firstThird', () => {
  it('keeps whole paragraphs and never reaches the ending', () => {
    const story = [
      paragraph('opening', 30),
      paragraph('middle', 30),
      paragraph('ending', 30),
    ].join('\n\n')
    const third = firstThird(story)
    expect(third.totalWords).toBe(90)
    expect(third.words).toBe(30)
    expect(third.text).toContain('opening0')
    expect(third.text).not.toContain('middle')
    expect(third.text).not.toContain('ending')
  })

  it('stops at the last paragraph that fits inside a third', () => {
    // 4 x 25 words = 100 words, so a third is 33: only one whole paragraph fits.
    const story = Array.from({ length: 4 }, (_, i) =>
      paragraph(`p${i}w`, 25),
    ).join('\n\n')
    const third = firstThird(story)
    expect(third.words).toBeLessThanOrEqual(Math.floor(third.totalWords / 3))
    expect(third.text).toBe(paragraph('p0w', 25))
  })

  it('cuts a long first paragraph at a sentence end, inside the limit', () => {
    const sentence = (n: number) => `${paragraph(`s${n}x`, 10)}.`
    const story = Array.from({ length: 9 }, (_, i) => sentence(i)).join(' ')
    const third = firstThird(story)
    expect(third.totalWords).toBe(90)
    expect(third.words).toBeLessThanOrEqual(30)
    expect(third.text.endsWith('.')).toBe(true)
    expect(third.text).not.toContain('s5x')
  })

  it('returns nothing for a text too short to have a third', () => {
    expect(firstThird('Just two').text).toBe('')
  })
})

describe('parseModelJson', () => {
  it('strips code fences and text around the object', () => {
    const reply = 'Here you go:\n```json\n{"hook": "A hook", "n": 1}\n```'
    expect(parseModelJson(reply)).toEqual({ hook: 'A hook', n: 1 })
  })

  it('returns null for text that is not a JSON object', () => {
    expect(parseModelJson('not json')).toBeNull()
    expect(parseModelJson('{"broken": ')).toBeNull()
    expect(parseModelJson('[1, 2]')).toBeNull()
  })
})

const MOODS = ['funny', 'eerie', 'whimsical']

describe('readAnalysis', () => {
  const reply = {
    moods: ['funny', 'Eerie', 'spooky'],
    contentNotes: {
      violence: { level: 'none', reason: 'should be dropped' },
      death: { level: 'mild', reason: ' A death is mentioned, not shown. ' },
      'frightening scenes': { level: 'strong', reason: '' },
      'sexual themes': 'none',
      'period racist language': { level: 'maybe', reason: 'x' },
    },
    ageBand: '10+',
    ageReason: 'Mild death; nothing graphic.',
  }

  it('keeps a reason only for a mild or strong note', () => {
    const a = readAnalysis(reply, MOODS)!
    expect(a.contentNotes.violence).toEqual({ level: 'none', reason: '' })
    expect(a.contentNotes.death).toEqual({
      level: 'mild',
      reason: 'A death is mentioned, not shown.',
    })
    expect(a.contentNotes['frightening scenes']).toEqual({
      level: 'strong',
      reason: '',
    })
  })

  it('accepts a bare level, and marks a missing or unknown level as unclear', () => {
    const a = readAnalysis(reply, MOODS)!
    expect(a.contentNotes['sexual themes']).toEqual({
      level: 'none',
      reason: '',
    })
    expect(a.contentNotes['period racist language'].level).toBeNull()
    expect(a.contentNotes['animal harm'].level).toBeNull()
  })

  it('keeps only catalog moods and says which it dropped', () => {
    const a = readAnalysis(reply, MOODS)!
    expect(a.moods).toEqual(['funny', 'eerie'])
    expect(a.droppedMoods).toEqual(['spooky'])
    expect(a.ageBand).toBe('10+')
  })
})

describe('the full-story prompt', () => {
  it('asks for a parent-ready age reason and spoiler-free note reasons', () => {
    const prompt = analysisPrompt('A story.', MOODS)
    expect(prompt).toContain('25 words or fewer')
    expect(prompt).toContain('what is NOT in the story')
    expect(prompt).toContain('12 words or fewer')
    expect(prompt).toContain('empty string')
  })
})

describe('fetchWithRetries', () => {
  const answer = (status: number) => new Response('{}', { status })
  const run = async (statuses: number[]) => {
    const waits: number[] = []
    const seen: number[] = []
    let calls = 0
    const response = await fetchWithRetries(
      async () => answer(statuses[Math.min(calls++, statuses.length - 1)]),
      {
        sleep: async (ms) => void waits.push(ms),
        onRetry: (status) => seen.push(status),
      },
    )
    return { response, waits, seen, calls }
  }

  it('retries 500 and 503 after 1s, 3s and 6s, then gives up', async () => {
    const { response, waits, seen, calls } = await run([503])
    expect(response.status).toBe(503)
    expect(calls).toBe(4)
    expect(waits).toEqual([...RETRY_DELAYS_MS])
    expect(waits).toEqual([1000, 3000, 6000])
    expect(seen).toEqual([503, 503, 503])
  })

  it('stops as soon as a try succeeds', async () => {
    const { response, waits, calls } = await run([500, 503, 200])
    expect(response.status).toBe(200)
    expect(calls).toBe(3)
    expect(waits).toEqual([1000, 3000])
  })

  it('does not retry other errors', async () => {
    const { response, waits, calls } = await run([400])
    expect(response.status).toBe(400)
    expect(calls).toBe(1)
    expect(waits).toEqual([])
  })
})
