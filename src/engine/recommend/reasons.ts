import type { CatalogEntry } from '../../catalog'
import type { Profile } from '../../stores'
import { facetWeight } from './score'

type Beliefs = Profile['facetBeliefs']

const FORM_WORD: Record<CatalogEntry['form'], string> = {
  story: 'story',
  novelette: 'novelette',
  novella: 'novella',
  essay: 'essay',
}

function withArticle(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`
}

function genrePhrase(genre: string): string {
  return genre.endsWith('story') ? `${genre.slice(0, -5)}stories` : genre
}

/** The mood or genre the reader likes best in this entry, if they like any (weight above 0.5). */
function bestLiked(entry: CatalogEntry, beliefs: Beliefs): string | null {
  let best: { phrase: string; weight: number } | null = null
  const consider = (key: string, phrase: string) => {
    const weight = facetWeight(beliefs, key)
    if (weight > 0.5 && (!best || weight > best.weight))
      best = { phrase, weight }
  }
  for (const mood of entry.moods) consider(`mood:${mood}`, `${mood} stories`)
  for (const genre of entry.genres)
    consider(`genre:${genre}`, genrePhrase(genre))
  return (best as { phrase: string } | null)?.phrase ?? null
}

/** "Something different: a funny essay". Uses the first mood the reader has not picked. */
export function wildcardReason(entry: CatalogEntry, beliefs: Beliefs): string {
  const mood =
    entry.moods.find((m) => facetWeight(beliefs, `mood:${m}`) <= 0.5) ??
    entry.moods[0]
  const noun = FORM_WORD[entry.form]
  return mood
    ? `Something different: ${withArticle(`${mood} ${noun}`)}`
    : `Something different: ${withArticle(noun)}`
}

export function starterReason(entry: CatalogEntry): string {
  const noun = FORM_WORD[entry.form]
  const mood = entry.moods[0]
  return mood
    ? `A good place to start: ${withArticle(`${mood} ${noun}`)}`
    : 'A good place to start'
}

export function personalReason(
  entry: CatalogEntry,
  beliefs: Beliefs,
  slots: readonly string[],
): string {
  if (slots.includes('wildcard')) return wildcardReason(entry, beliefs)
  const liked = bestLiked(entry, beliefs)
  if (liked) return `Because you like ${liked}`
  if (slots.includes('essay')) return 'An essay worth a try'
  if (slots.includes('short'))
    return `Quick to read: ${entry.readingMinutes} minutes`
  return 'Picked for your taste'
}
