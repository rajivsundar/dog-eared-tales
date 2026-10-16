import type { CatalogEntry } from '../../catalog'

/**
 * Words for moods and genres in reason lines. A genre or mood on its own ("literary", "eerie") is
 * not a noun, so each is given one: "literary stories", "eerie essays". A few genres are nouns
 * already ("satire", "romance") and are used as they are.
 */

type Form = CatalogEntry['form']

/** Genres that are nouns already, with the phrase for one work of that kind. */
const NOUN_GENRES: Record<string, { singular: string }> = {
  satire: { singular: 'satire' },
  humour: { singular: 'humorous story' },
  romance: { singular: 'romance' },
  philosophy: { singular: 'philosophical work' },
  'social criticism': { singular: 'work of social criticism' },
}

const isEssay = (form: Form | undefined): boolean => form === 'essay'

/** "ghost story" -> "ghost stories"; "literary" -> "literary stories"; "satire" -> "satire". */
export function genrePlural(genre: string, form?: Form): string {
  if (isEssay(form)) return `${genre} essays`
  if (genre in NOUN_GENRES) return genre
  return genre.endsWith('story')
    ? `${genre.slice(0, -5)}stories`
    : `${genre} stories`
}

/** One work of the genre: "ghost story", "literary story", "satire", "philosophy essay". */
export function genreSingular(genre: string, form?: Form): string {
  if (isEssay(form)) return `${genre} essay`
  if (genre in NOUN_GENRES) return NOUN_GENRES[genre].singular
  return genre.endsWith('story') ? genre : `${genre} story`
}

/** "eerie stories", or "eerie essays" for an essay. */
export function moodPlural(mood: string, form?: Form): string {
  return `${mood} ${isEssay(form) ? 'essays' : 'stories'}`
}

/** "eerie story", or "eerie essay" for an essay. */
export function moodSingular(mood: string, form?: Form): string {
  return `${mood} ${isEssay(form) ? 'essay' : 'story'}`
}
