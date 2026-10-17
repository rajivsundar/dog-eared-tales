import { useEffect, useState } from 'react'
import { settingsStore } from '../stores'
import { type Season, currentSeason } from './seasons'

/**
 * The season to show now, or undefined outside every season or when the reader switched seasonal
 * themes off. `ready` turns true once the reader's setting has been read.
 */
export function useSeason(now: Date): {
  season: Season | undefined
  ready: boolean
} {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    settingsStore
      .get()
      .then((s) => {
        if (!cancelled) setEnabled(s.seasonalThemes !== false)
      })
      .catch(() => {
        if (!cancelled) setEnabled(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return {
    season: enabled ? currentSeason(now, true) : undefined,
    ready: enabled !== null,
  }
}
