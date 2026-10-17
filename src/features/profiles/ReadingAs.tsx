import { useRef, useState } from 'react'
import { profileManager } from '../../stores'
import { ProfileDot } from './ProfileDot'
import { ProfileTiles } from './ProfileTiles'
import { useProfiles } from './useProfiles'

/**
 * "Reading as <name> ▾" at the top of Your Shortlist, with 2+ profiles (or as the guest). Opens a
 * quick switcher. Choosing a profile re-opens the app on it.
 */
export function ReadingAs() {
  const snapshot = useProfiles()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  if (snapshot.profiles.length < 2 && snapshot.mode !== 'guest') return null

  const guest = snapshot.mode === 'guest'
  const name = guest ? 'Guest' : (snapshot.active?.name ?? '')

  const close = (): void => {
    setOpen(false)
    button.current?.focus()
  }
  const choose = (task: Promise<void>): void => {
    setBusy(true)
    task
      .catch((error: unknown) => console.error(error))
      .finally(() => {
        setBusy(false)
        setOpen(false)
      })
  }

  return (
    <div
      className="mb-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) close()
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="reading-as-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {snapshot.active && (
          <ProfileDot color={snapshot.active.color} size="sm" />
        )}
        {guest && <ProfileDot color="slate" size="sm" dashed />}
        <span>
          Reading as <strong>{name}</strong>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          id="reading-as-panel"
          role="group"
          aria-label="Switch profile"
          className="mt-3 rounded-card border border-line bg-page p-3"
        >
          <ProfileTiles
            marks="reading-now"
            snapshot={snapshot}
            disabled={busy}
            onPick={(id) => {
              if (snapshot.active?.id === id) return close()
              choose(profileManager.switchTo(id))
            }}
            onGuest={() => choose(profileManager.startGuest())}
          />
        </div>
      )}
    </div>
  )
}
