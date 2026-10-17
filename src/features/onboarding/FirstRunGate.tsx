import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { eventLog, profileStore } from '../../stores'
import { useProfiles } from '../profiles/useProfiles'
import { isFirstRun } from './finishOnboarding'

/** Sends a first-time reader (no profile, no events) to onboarding. Everyone else sees the children. */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'first' | 'ready'>('checking')
  const guest = useProfiles().mode === 'guest'

  useEffect(() => {
    // A guest skips the welcome and onboarding: they see a starter mix.
    if (guest) return
    let cancelled = false
    isFirstRun({ events: eventLog, profile: profileStore })
      .then((first) => {
        if (!cancelled) setState(first ? 'first' : 'ready')
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setState('ready')
      })
    return () => {
      cancelled = true
    }
  }, [guest])

  if (guest) return <>{children}</>
  if (state === 'first') return <Navigate to="/welcome" replace />
  if (state === 'checking') {
    return (
      <p role="status" className="p-6 text-center text-muted">
        Loading…
      </p>
    )
  }
  return <>{children}</>
}
