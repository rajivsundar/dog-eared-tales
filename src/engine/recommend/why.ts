import type { CatalogEntry } from '../../catalog'
import type { Profile } from '../../stores'
import { netWeight } from './learn'
import { genrePlural, moodPlural } from './wording'

function listOf(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * The "Why this pick?" line: a plain sentence about what put the story on the shortlist.
 * `reason` is the one-line reason stored with the pick.
 */
export function whyThisPick(
  entry: CatalogEntry,
  reason: string,
  beliefs: Profile['facetBeliefs'],
  kind: 'shortlist' | 'long' = 'shortlist',
): string {
  if (kind === 'long') {
    return 'A longer read for when you are ready, ranked by the moods and genres you have liked. It is split into sittings that fit how you usually read.'
  }
  if (reason.startsWith('A good place to start')) {
    return 'You have not told us your taste yet, so this is part of a varied starter mix. Rate a few stories and your picks will tune themselves.'
  }
  if (reason.startsWith('Something different')) {
    return 'This is your wildcard: it comes from a mood you have not picked yet, to widen your taste.'
  }
  const liked = [
    ...entry.moods
      .filter((m) => netWeight(beliefs, `mood:${m}`) > 0)
      .map((m) => moodPlural(m, entry.form)),
    ...entry.genres
      .filter((g) => netWeight(beliefs, `genre:${g}`) > 0)
      .map((g) => genrePlural(g, entry.form)),
  ]
  const lengthLiked = netWeight(beliefs, `length:${entry.lengthClass}`) > 0
  if (liked.length > 0) {
    return `It matches what you like: ${listOf(liked)}.${
      lengthLiked ? ' You also tend to enjoy reads of this length.' : ''
    }`
  }
  return 'It rounds out your list: a short read or an essay among your usual picks.'
}
