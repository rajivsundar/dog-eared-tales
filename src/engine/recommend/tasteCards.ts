import type { CatalogEntry } from '../../catalog'
import { recommend } from './recommend'

export const TASTE_CARD_COUNT = 8

const byId = (a: CatalogEntry, b: CatalogEntry): number =>
  a.id.localeCompare(b.id)

/**
 * The 8 works shown as taste cards during onboarding.
 *
 * With picked moods: up to 5 cards come from those moods (one per mood, so they differ), the rest
 * from other moods. With no moods (the reader skipped the mood board), the cards are the balanced
 * starter mix. Either way there is at least one essay and one story under 10 minutes, when the
 * catalog has them. The same input always gives the same cards.
 */
export function pickTasteCards(
  catalog: CatalogEntry[],
  moods: string[],
  count = TASTE_CARD_COUNT,
): CatalogEntry[] {
  if (moods.length === 0) {
    return recommend({ catalog, profile: null, events: [], count }).picks.map(
      (p) => p.entry,
    )
  }

  const sorted = [...catalog].sort(byId)
  const chosen: CatalogEntry[] = []
  const usedFirstMoods = new Set<string>()
  const add = (e: CatalogEntry | undefined): boolean => {
    if (!e || chosen.length >= count || chosen.includes(e)) return false
    chosen.push(e)
    if (e.moods[0]) usedFirstMoods.add(e.moods[0])
    return true
  }

  // One card for each picked mood, from works that have that mood.
  for (const mood of moods) {
    const options = sorted.filter(
      (e) => !chosen.includes(e) && e.moods.includes(mood),
    )
    add(
      options.find((e) => e.moods[0] && !usedFirstMoods.has(e.moods[0])) ??
        options[0],
    )
  }

  // Then works from other moods, trying to keep the moods different.
  const others = sorted.filter(
    (e) => !chosen.includes(e) && !e.moods.some((m) => moods.includes(m)),
  )
  const isFresh = (e: CatalogEntry) =>
    e.moods[0] !== undefined && !usedFirstMoods.has(e.moods[0])
  while (chosen.length < count) {
    const next =
      others.find((e) => !chosen.includes(e) && isFresh(e)) ??
      others.find((e) => !chosen.includes(e)) ??
      sorted.find((e) => !chosen.includes(e))
    if (!add(next)) break
  }

  // At least one essay and one story under 10 minutes: swap one in for the last other-mood card.
  const ensure = (test: (e: CatalogEntry) => boolean): void => {
    if (chosen.some(test)) return
    const replacement =
      sorted.find(
        (e) =>
          !chosen.includes(e) &&
          test(e) &&
          e.moods.some((m) => moods.includes(m)),
      ) ?? sorted.find((e) => !chosen.includes(e) && test(e))
    if (!replacement) return
    // Replace the last card that is not the only essay or only short story.
    for (let i = chosen.length - 1; i >= 0; i--) {
      const rest = chosen.filter((_, j) => j !== i)
      const keepsEssay =
        rest.some((e) => e.form === 'essay') || chosen[i].form !== 'essay'
      const keepsShort =
        rest.some((e) => e.lengthClass === 'under10') ||
        chosen[i].lengthClass !== 'under10'
      if (keepsEssay && keepsShort) {
        chosen[i] = replacement
        return
      }
    }
  }
  ensure((e) => e.form === 'essay')
  ensure((e) => e.lengthClass === 'under10')
  return chosen
}
