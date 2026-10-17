import type { ProfileSnapshot } from '../../stores'
import { ProfileDot } from './ProfileDot'
import { colorName } from './colors'
import { lastUsedProfile } from './useProfiles'

const tile =
  'flex min-h-16 w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60'

/**
 * One tile for each reading profile, then "Read as guest". Used by Who's reading? and by the
 * quick switcher on Your Shortlist.
 */
export function ProfileTiles({
  snapshot,
  onPick,
  onGuest,
  disabled = false,
  marks,
}: {
  snapshot: ProfileSnapshot
  onPick: (id: string) => void
  onGuest: () => void
  disabled?: boolean
  /** Who's reading? marks the last used profile; the quick switcher marks the one open now. */
  marks: 'last-used' | 'reading-now'
}) {
  const last = lastUsedProfile(snapshot)
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {snapshot.profiles.map((profile) => {
        const open = snapshot.active?.id === profile.id
        const notes = [
          colorName(profile.color),
          marks === 'reading-now' && open ? 'Reading now' : null,
          marks === 'last-used' &&
          last?.id === profile.id &&
          snapshot.profiles.length > 1
            ? 'Last used'
            : null,
        ].filter(Boolean)
        return (
          <li key={profile.id}>
            <button
              type="button"
              className={tile}
              disabled={disabled}
              aria-current={open ? 'true' : undefined}
              onClick={() => onPick(profile.id)}
            >
              <ProfileDot color={profile.color} />
              <span>
                <span className="block font-semibold">{profile.name}</span>
                <span className="block text-sm text-muted">
                  {notes.join(' · ')}
                </span>
              </span>
            </button>
          </li>
        )
      })}
      {snapshot.mode !== 'guest' && (
        <li>
          <button
            type="button"
            className={`${tile} border-dashed`}
            disabled={disabled}
            onClick={onGuest}
          >
            <ProfileDot color="slate" dashed />
            <span>
              <span className="block font-semibold">Read as guest</span>
              <span className="block text-sm text-muted">Nothing is saved</span>
            </span>
          </button>
        </li>
      )}
    </ul>
  )
}
