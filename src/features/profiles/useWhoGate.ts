import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { type ProfileSnapshot, profileManager } from '../../stores'

/**
 * Sends the reader to "Who's reading?" when it is due: once per browser session, again after 30
 * minutes away, or when the open profile was deleted in another tab. Remembers where they were.
 */
export function useWhoGate(snapshot: ProfileSnapshot): void {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const due =
    snapshot.status === 'ready' && (snapshot.askWho || snapshot.mode === 'none')

  useEffect(() => {
    if (due && pathname !== '/who') {
      navigate('/who', {
        replace: true,
        state: { from: `${pathname}${search}` },
      })
    }
  }, [due, pathname, search, navigate])

  useEffect(() => {
    const onChange = (): void => {
      if (document.visibilityState === 'hidden') profileManager.noteAway()
      else profileManager.noteBack()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
}
