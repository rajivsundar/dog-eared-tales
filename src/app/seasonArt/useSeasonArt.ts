import { useEffect, useState } from 'react'
import type { SeasonArtId } from '../seasons'
import type { SeasonArt } from './types'

/** Each season's artwork loads on its own, only while that season shows. */
const LOADERS: Record<SeasonArtId, () => Promise<{ default: SeasonArt }>> = {
  fall: () => import('./fall'),
}

/** The artwork for a season, once loaded. Null when there is none, so nothing is drawn. */
export function useSeasonArt(id: SeasonArtId | undefined): SeasonArt | null {
  const [loaded, setLoaded] = useState<{
    id: SeasonArtId
    art: SeasonArt
  } | null>(null)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    LOADERS[id]()
      .then((module) => {
        if (!cancelled) setLoaded({ id, art: module.default })
      })
      .catch((error: unknown) => console.debug('no season art', error))
    return () => {
      cancelled = true
    }
  }, [id])
  return id && loaded?.id === id ? loaded.art : null
}
