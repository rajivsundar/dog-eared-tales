import { DEFAULT_WELCOME, type WelcomeContent } from '../../app/seasons'
import type { CatalogEntry } from '../../catalog'

export interface WelcomeView {
  content: WelcomeContent
  /** The short story the main button opens, or undefined if the catalog has none. */
  featured: CatalogEntry | undefined
  /** The covers for the fan (up to 3), in order. */
  covers: CatalogEntry[]
}

const isShort = (e: CatalogEntry): boolean => e.lengthClass === 'under10'

/**
 * The featured story: the season's pick if it is in the catalog and under 10 minutes; otherwise
 * The Open Window; otherwise the first story under 10 minutes.
 */
export function pickFeaturedStory(
  catalog: CatalogEntry[],
  featuredStoryId: string,
): CatalogEntry | undefined {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  for (const id of [featuredStoryId, DEFAULT_WELCOME.featuredStoryId]) {
    const entry = byId.get(id)
    if (entry && isShort(entry)) return entry
  }
  return catalog.find(isShort)
}

/** Puts the catalog together with the season's content, for the welcome page. */
export function welcomeView(
  content: WelcomeContent,
  catalog: CatalogEntry[],
): WelcomeView {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const covers = content.coverIds.flatMap((id) => {
    const entry = byId.get(id)
    return entry ? [entry] : []
  })
  return {
    content,
    featured: pickFeaturedStory(catalog, content.featuredStoryId),
    covers,
  }
}
