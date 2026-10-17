import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { profileManager } from '../../stores'
import { ProfileTiles } from './ProfileTiles'
import { useProfiles } from './useProfiles'

/** Who's reading? Shown once per browser session, and after 30 minutes away, with 2+ profiles. */
export default function WhoScreen() {
  const snapshot = useProfiles()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Back to where the reader was, if they were sent here from somewhere.
  const from = (location.state as { from?: string } | null)?.from
  const done = (): void => {
    void navigate(from && !from.startsWith('/who') ? from : '/', {
      replace: true,
    })
  }

  const run = (task: Promise<void>): void => {
    setBusy(true)
    setFailed(false)
    task.then(done).catch((error: unknown) => {
      console.error(error)
      setFailed(true)
      setBusy(false)
    })
  }

  return (
    <main className="mx-auto max-w-xl px-gutter py-10 sm:py-16">
      <h1 className="font-serif text-3xl font-bold">Who’s reading?</h1>
      <p className="mt-2 text-muted">
        Each profile keeps its own picks, Library and place in every story.
      </p>
      <div className="mt-6">
        <ProfileTiles
          marks="last-used"
          snapshot={snapshot}
          disabled={busy}
          onPick={(id) => run(profileManager.switchTo(id))}
          onGuest={() => run(profileManager.startGuest())}
        />
      </div>
      {failed && (
        <p role="alert" className="mt-4 font-semibold">
          We couldn’t open that profile. Try again.
        </p>
      )}
      <p className="mt-8 text-sm text-muted">
        <Link to="/settings" className="underline">
          Manage profiles in Settings
        </Link>
      </p>
    </main>
  )
}
