import { useEffect, useSyncExternalStore } from 'react'
import { type ProfileSnapshot, profileManager } from '../../stores'

/** Which reading profile is open, and the list of profiles. Re-renders when either changes. */
export function useProfiles(): ProfileSnapshot {
  const snapshot = useSyncExternalStore(
    profileManager.subscribe,
    profileManager.current,
  )
  useEffect(() => {
    void profileManager.ready()
  }, [])
  return snapshot
}

/** The profile used most recently, or undefined with no profiles. */
export function lastUsedProfile(snapshot: ProfileSnapshot) {
  return [...snapshot.profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0]
}
