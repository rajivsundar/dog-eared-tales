// Story Guide: the pure logic (splitting a story, writing the prompts, reading Gemma's replies,
// checking the hook and blurb). No network and no files, so it can be tested on its own.
// This is a build-time tool. It never ships in the app.

import { bannedWordsIn, copiedRun } from '../../scripts/curationChecks.ts'

export const HOOK_MAX_WORDS = 20
export const BLURB_MAX_WORDS = 60

export const NOTE_KINDS = [
  'violence',
  'death',
  'frightening scenes',
  'sexual themes',
  'period racist language',
  'animal harm',
] as const
export const INTENSITIES = ['none', 'mild', 'strong'] as const
export const AGE_BANDS = ['All ages', '10+', '13+', '16+'] as const

export type NoteKind = (typeof NOTE_KINDS)[number]
export type Intensity = (typeof INTENSITIES)[number]
export type AgeBand = (typeof AGE_BANDS)[number]

const countWords = (text: string): number => text.match(/\S+/g)?.length ?? 0

/**
 * The opening third of a story, by word count. It cuts at a paragraph break, so the blurb is
 * written from whole paragraphs; if the first paragraph alone is longer than a third, it cuts at
 * the last sentence end (or, failing that, the last word) inside the limit. It never returns more
 * than a third of the words.
 */
export function firstThird(text: string): {
  text: string
  words: number
  totalWords: number
} {
  const totalWords = countWords(text)
  const limit = Math.floor(totalWords / 3)
  if (limit === 0) return { text: '', words: 0, totalWords }

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== '')
  const kept: string[] = []
  let used = 0
  for (const paragraph of paragraphs) {
    const n = countWords(paragraph)
    if (used + n > limit) break
    kept.push(paragraph.trim())
    used += n
  }
  if (kept.length > 0)
    return { text: kept.join('\n\n'), words: used, totalWords }

  // The first paragraph is longer than a third: cut inside it.
  const words = paragraphs[0].trim().split(/\s+/).slice(0, limit)
  let cut = words.join(' ')
  const lastStop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  )
  if (lastStop > 0) cut = cut.slice(0, lastStop + 1)
  return { text: cut, words: countWords(cut), totalWords }
}

export function openingPrompt(opening: string): string {
  return `You write short, spoiler-free descriptions of public-domain stories for a reading app.

Below is ONLY THE FIRST THIRD of a story. You have not seen the rest. Write:
- "hook": one line of ${HOOK_MAX_WORDS} words or fewer that makes a reader curious.
- "blurb": ${BLURB_MAX_WORDS} words or fewer that sets up the premise: who, where, and what is at stake.

Rules:
- Set up the premise only. Do not hint at a turn, a twist, a reveal or the ending, and do not guess how it ends.
- Do not use the words: twist, irony, ironic, surprise, unexpected, heartbreaking, jealousy, refusal, regret.
- Do not copy six or more words in a row from the story. Use your own words.
- Plain, warm language. No spoiler warnings, no star ratings.

Reply with JSON only, no code fences and no other text, in exactly this shape:
{"hook": "...", "blurb": "..."}

THE FIRST THIRD OF THE STORY:
"""
${opening}
"""`
}

export function analysisPrompt(
  story: string,
  moods: readonly string[],
): string {
  return `You help a reading app label public-domain stories for readers and parents.

Read the WHOLE story below, then reply with these labels:
- "moods": up to 3 moods that best fit the story, chosen ONLY from this list: ${moods.join(', ')}. Use the exact words. Choose fewer than 3 if fewer fit.
- "contentNotes": an object with exactly these six keys: ${NOTE_KINDS.map((k) => `"${k}"`).join(', ')}. Each value is exactly one of "none", "mild" or "strong", judged by what is actually in the story. "period racist language" means racist words or attitudes common in the era it was written.
- "ageBand": exactly one of ${AGE_BANDS.map((a) => `"${a}"`).join(', ')}, the youngest age the story suits.
- "ageReason": ONE sentence for parents explaining the age band.

Reply with JSON only, no code fences and no other text, in exactly this shape:
{"moods": ["..."], "contentNotes": {"violence": "none", "death": "none", "frightening scenes": "none", "sexual themes": "none", "period racist language": "none", "animal harm": "none"}, "ageBand": "...", "ageReason": "..."}

THE STORY:
"""
${story}
"""`
}

export const retryNote =
  '\n\nYour last reply could not be read as JSON. Reply again with ONLY the JSON object, no code fences and no other text.'

/** Parses a model reply as a JSON object: drops code fences and anything around the braces. */
export function parseModelJson(reply: string): Record<string, unknown> | null {
  const unfenced = reply.replace(/```(?:json)?/gi, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const value: unknown = JSON.parse(unfenced.slice(start, end + 1))
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const isString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== ''

export interface Opening {
  hook: string
  blurb: string
}

export function readOpening(
  json: Record<string, unknown> | null,
): Opening | null {
  if (!json || !isString(json.hook) || !isString(json.blurb)) return null
  return { hook: json.hook.trim(), blurb: json.blurb.trim() }
}

export interface Analysis {
  moods: string[]
  /** Moods Gemma named that are not in the catalog's list (dropped). */
  droppedMoods: string[]
  /** Intensity per kind; null when Gemma's answer was missing or not none/mild/strong. */
  contentNotes: Record<NoteKind, Intensity | null>
  ageBand: AgeBand | null
  ageReason: string
}

export function readAnalysis(
  json: Record<string, unknown> | null,
  allowedMoods: readonly string[],
): Analysis | null {
  if (!json || !Array.isArray(json.moods)) return null
  if (json.contentNotes === null || typeof json.contentNotes !== 'object')
    return null
  const named = json.moods
    .filter((m): m is string => typeof m === 'string')
    .map((m) => m.trim().toLowerCase())
  const moods = [
    ...new Set(named.filter((m) => allowedMoods.includes(m))),
  ].slice(0, 3)
  const droppedMoods = named.filter((m) => !allowedMoods.includes(m))

  const raw = json.contentNotes as Record<string, unknown>
  const contentNotes = {} as Record<NoteKind, Intensity | null>
  for (const kind of NOTE_KINDS) {
    const value =
      typeof raw[kind] === 'string' ? raw[kind].trim().toLowerCase() : ''
    contentNotes[kind] = (INTENSITIES as readonly string[]).includes(value)
      ? (value as Intensity)
      : null
  }

  const band = typeof json.ageBand === 'string' ? json.ageBand.trim() : ''
  const ageBand =
    (AGE_BANDS as readonly string[]).find(
      (a) => a.toLowerCase() === band.toLowerCase(),
    ) ?? null
  return {
    moods,
    droppedMoods,
    contentNotes,
    ageBand: ageBand as AgeBand | null,
    ageReason: isString(json.ageReason) ? json.ageReason.trim() : '',
  }
}

export interface FieldChecks {
  words: number
  limit: number
  overLimit: boolean
  banned: string[]
  copied: string | null
  /** True when every check passed. */
  ok: boolean
}

/** The existing curation checks (banned words, six-word copies) plus the word limits. */
export function checkDescription(
  text: string,
  limit: number,
  story: string,
): FieldChecks {
  const words = countWords(text)
  const banned = bannedWordsIn(text)
  const copied = copiedRun(story, text)
  const overLimit = words > limit
  return {
    words,
    limit,
    overLimit,
    banned,
    copied,
    ok: !overLimit && banned.length === 0 && !copied,
  }
}

/**
 * Asks the model, reads the reply, and asks once more if the reply was not usable JSON.
 * `ask` sends one prompt and returns the model's text.
 */
export async function askForJson<T>(
  ask: (prompt: string) => Promise<string>,
  prompt: string,
  read: (json: Record<string, unknown> | null) => T | null,
): Promise<{ value: T; retried: boolean }> {
  const first = read(parseModelJson(await ask(prompt)))
  if (first) return { value: first, retried: false }
  const second = read(parseModelJson(await ask(prompt + retryNote)))
  if (second) return { value: second, retried: true }
  throw new Error('Gemma did not return usable JSON, even after one retry.')
}
