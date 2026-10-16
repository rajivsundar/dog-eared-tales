import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { eventLog, profileStore } from '../../stores'
import { isFirstRun } from './finishOnboarding'

/** Sends a first-time reader (no profile, no events) to onboarding. Everyone else sees the children. */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'first' | 'ready'>('checking')

  useEffect(() => {
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
  }, [])

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
