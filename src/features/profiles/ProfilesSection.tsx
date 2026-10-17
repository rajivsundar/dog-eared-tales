import { useState } from 'react'
import { useNavigate } from 'react-router'
import { profileManager } from '../../stores'
// Values are imported from their own files so tests can stand in for the stores module.
import { ProfileError } from '../../stores/profileManager'
import {
  MAX_PROFILE_NAME,
  MAX_READING_PROFILES,
  PROFILE_COLORS,
  type ProfileColor,
  type ReadingProfile,
} from '../../stores/types'
import { DELETE_WORD } from '../data/dataActions'
import { ProfileDot } from './ProfileDot'
import { colorName } from './colors'
import { lastUsedProfile, useProfiles } from './useProfiles'

const button =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const strong =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'
const field = 'mt-1 min-h-11 w-full rounded-lg border border-line bg-page px-3'

function ColorChoice({
  value,
  onChange,
  name,
}: {
  value: ProfileColor
  onChange: (color: ProfileColor) => void
  name: string
}) {
  return (
    <fieldset className="mt-3">
      <legend className="font-semibold">Colour</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {PROFILE_COLORS.map((c) => (
          <label
            key={c.id}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
              value === c.id ? 'border-accent font-semibold' : 'border-line'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={c.id}
              checked={value === c.id}
              onChange={() => onChange(c.id)}
              className="sr-only"
            />
            <ProfileDot color={c.id} size="sm" />
            {c.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type Editing =
  { id: string; kind: 'rename' | 'recolor' | 'delete' } | { kind: 'add' }

/** Settings → Profiles: add, rename, recolour, switch and delete, plus Read as guest. */
export function ProfilesSection() {
  const snapshot = useProfiles()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState<ProfileColor>('rust')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)

  const { profiles } = snapshot
  const full = profiles.length >= MAX_READING_PROFILES
  const only = profiles.length <= 1

  const stop = (): void => {
    setEditing(null)
    setText('')
    setTyped('')
  }
  const say = (words: string, error = false): void =>
    setMessage({ text: words, error })
  const fail = (error: unknown): void => {
    if (!(error instanceof ProfileError)) console.error(error)
    say(
      error instanceof ProfileError ? error.message : 'Something went wrong.',
      true,
    )
  }
  const act = (task: () => Promise<unknown>, done?: () => void): void => {
    setBusy(true)
    setMessage(null)
    task()
      .then(() => {
        stop()
        done?.()
      })
      .catch(fail)
      .finally(() => setBusy(false))
  }

  const start = (next: Editing, profile?: ReadingProfile): void => {
    setMessage(null)
    setTyped('')
    setEditing(next)
    if (next.kind === 'add') {
      setText(profileManager.suggestName())
      const used = profiles.map((p) => p.color)
      setColor(PROFILE_COLORS.find((c) => !used.includes(c.id))?.id ?? 'rust')
    } else if (next.kind === 'rename') {
      setText(profile?.name ?? '')
    } else if (next.kind === 'recolor') {
      setColor(profile?.color ?? 'rust')
    }
  }

  const add = (): void =>
    act(
      async () => {
        const created = await profileManager.create({ name: text, color })
        await profileManager.switchTo(created.id)
      },
      // A new profile starts with the welcome and onboarding.
      () => navigate('/welcome'),
    )

  const guest = snapshot.mode === 'guest'
  const back = lastUsedProfile(snapshot)

  return (
    <section aria-labelledby="profiles-title" className="mt-10">
      <h2 id="profiles-title" className="font-serif text-2xl font-bold">
        Profiles
      </h2>
      <p className="mt-2 text-muted">
        Profiles keep reading separate; they don’t lock anyone out. Each one has
        its own picks, Library and place in every story, kept on this device.
      </p>
      <p className="mt-2 text-muted">Twice Told is for readers 16 and over.</p>

      {guest && (
        <div className="mt-4 rounded-card border border-dashed border-line bg-surface p-4">
          <p>You’re reading as a guest. Nothing you do is saved.</p>
          <button
            type="button"
            className={`${strong} mt-3`}
            disabled={busy}
            onClick={() => act(() => profileManager.endGuest())}
          >
            Back to {back?.name}
          </button>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {profiles.map((profile) => {
          const open = snapshot.active?.id === profile.id
          const mine = editing && 'id' in editing && editing.id === profile.id
          return (
            <li
              key={profile.id}
              className="rounded-card border border-line bg-surface p-4"
            >
              <div className="flex items-center gap-3">
                <ProfileDot color={profile.color} />
                <p className="min-w-0 flex-1">
                  <span className="font-semibold">{profile.name}</span>
                  <span className="block text-sm text-muted">
                    {colorName(profile.color)}
                    {open ? ' · Reading now' : ''}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!open && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    aria-label={`Switch to ${profile.name}`}
                    onClick={() =>
                      act(
                        () => profileManager.switchTo(profile.id),
                        () => navigate('/'),
                      )
                    }
                  >
                    Switch
                  </button>
                )}
                <button
                  type="button"
                  className={button}
                  aria-label={`Rename ${profile.name}`}
                  onClick={() =>
                    start({ id: profile.id, kind: 'rename' }, profile)
                  }
                >
                  Rename
                </button>
                <button
                  type="button"
                  className={button}
                  aria-label={`Change colour of ${profile.name}`}
                  onClick={() =>
                    start({ id: profile.id, kind: 'recolor' }, profile)
                  }
                >
                  Colour
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={only}
                  aria-label={`Delete ${profile.name}`}
                  onClick={() =>
                    start({ id: profile.id, kind: 'delete' }, profile)
                  }
                >
                  Delete
                </button>
              </div>
              {only && (
                <p className="mt-2 text-sm text-muted">
                  This is your only profile, so it can’t be deleted. To start
                  over, use Delete all my data below.
                </p>
              )}

              {mine && editing.kind === 'rename' && (
                <form
                  className="mt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    act(() => profileManager.rename(profile.id, text))
                  }}
                >
                  <label className="block">
                    <span className="block">Name</span>
                    <input
                      type="text"
                      value={text}
                      maxLength={MAX_PROFILE_NAME}
                      onChange={(e) => setText(e.target.value)}
                      className={field}
                    />
                  </label>
                  <div className="mt-3 flex gap-3">
                    <button type="submit" className={strong} disabled={busy}>
                      Save name
                    </button>
                    <button type="button" className={button} onClick={stop}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {mine && editing.kind === 'recolor' && (
                <div className="mt-3">
                  <ColorChoice
                    value={color}
                    onChange={setColor}
                    name={`color-${profile.id}`}
                  />
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      className={strong}
                      disabled={busy}
                      onClick={() =>
                        act(() => profileManager.recolor(profile.id, color))
                      }
                    >
                      Save colour
                    </button>
                    <button type="button" className={button} onClick={stop}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {mine && editing.kind === 'delete' && (
                <div
                  role="alertdialog"
                  aria-label={`Delete ${profile.name}`}
                  className="mt-3 rounded-card border border-line bg-page p-4"
                >
                  <p>
                    Delete {profile.name} and everything they’ve read, Dog-eared
                    and taught Twice Told? Other profiles are not touched. It
                    cannot be undone.
                  </p>
                  <label className="mt-3 block">
                    <span className="block">Type {DELETE_WORD} to confirm</span>
                    <input
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className={field}
                    />
                  </label>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      className={strong}
                      disabled={typed !== DELETE_WORD || busy}
                      onClick={() =>
                        act(
                          () => profileManager.remove(profile.id),
                          () => say(`Deleted ${profile.name}.`),
                        )
                      }
                    >
                      Delete {profile.name}
                    </button>
                    <button type="button" className={button} onClick={stop}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`mt-3 ${message.error ? 'font-semibold' : 'text-muted'}`}
        >
          {message.text}
        </p>
      )}

      {editing?.kind === 'add' ? (
        <form
          className="mt-4 rounded-card border border-line bg-surface p-4"
          aria-label="Add a profile"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label className="block">
            <span className="block">Name</span>
            <input
              type="text"
              value={text}
              maxLength={MAX_PROFILE_NAME}
              onChange={(e) => setText(e.target.value)}
              className={field}
            />
          </label>
          <ColorChoice value={color} onChange={setColor} name="color-new" />
          <div className="mt-3 flex gap-3">
            <button type="submit" className={strong} disabled={busy}>
              Add profile
            </button>
            <button type="button" className={button} onClick={stop}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={button}
            disabled={full || busy}
            onClick={() => start({ kind: 'add' })}
          >
            Add a profile
          </button>
          {!guest && (
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() =>
                act(
                  () => profileManager.startGuest(),
                  () => navigate('/'),
                )
              }
            >
              Read as guest
            </button>
          )}
          {full && (
            <p className="text-sm text-muted">
              {MAX_READING_PROFILES} profiles is the most one device keeps.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
