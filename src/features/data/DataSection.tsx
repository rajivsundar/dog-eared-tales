import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { clearTextCache } from '../../pwa/textCache'
import { profileManager } from '../../stores'
import { type BackupFile, BackupError } from '../../stores/backup'
import { ProfileError } from '../../stores/profileManager'
import { MAX_READING_PROFILES } from '../../stores/types'
import { useProfiles } from '../profiles/useProfiles'
import {
  DELETE_WORD,
  addBackupAsProfile,
  deleteAllData,
  downloadTextFile,
  makeAllProfilesBackup,
  makeBackup,
  readBackupFile,
  replaceEverythingFromBackup,
  replaceProfileFromBackup,
} from './dataActions'

const button =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const danger =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

/** Settings → Your data: export a backup, import one, or delete everything. */
export function DataSection() {
  const navigate = useNavigate()
  const snapshot = useProfiles()
  const many = snapshot.profiles.length >= 2
  const openName = snapshot.active?.name ?? 'Guest'
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  // "Replace this profile" asks a second time.
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const say = (text: string, error = false): void => setMessage({ text, error })
  const cancelImport = (): void => {
    setPending(null)
    setConfirmReplace(false)
  }
  const problem = (error: unknown, fallback: string): void => {
    if (!(error instanceof BackupError) && !(error instanceof ProfileError)) {
      console.error(error)
    }
    say(
      error instanceof BackupError || error instanceof ProfileError
        ? error.message
        : fallback,
      true,
    )
  }

  const save = (made: Promise<{ filename: string; text: string }>): void => {
    setMessage(null)
    made
      .then(({ filename, text }) => {
        downloadTextFile(filename, text)
        say(`Saved ${filename}.`)
      })
      .catch((error: unknown) => problem(error, 'We couldn’t make the backup.'))
  }

  const onFile = (file: File | undefined): void => {
    setMessage(null)
    cancelImport()
    if (!file) return
    readBackupFile(file)
      .then(setPending)
      .catch((error: unknown) => problem(error, 'We couldn’t read that file.'))
    if (fileInput.current) fileInput.current.value = ''
  }

  const finish = (task: Promise<unknown>, done: () => void): void => {
    setBusy(true)
    task
      .then(() => {
        cancelImport()
        done()
      })
      .catch((error: unknown) =>
        problem(error, 'We couldn’t restore that backup. Nothing was changed.'),
      )
      .finally(() => setBusy(false))
  }

  const onDelete = (): void => {
    if (typed !== DELETE_WORD || busy) return
    setBusy(true)
    deleteAllData({
      everything: () => profileManager.deleteEverything(),
      clearTexts: clearTextCache,
    })
      .then(() => navigate('/welcome', { replace: true }))
      .catch((error: unknown) => {
        console.error(error)
        say('We couldn’t delete everything.', true)
        setBusy(false)
      })
  }

  const when = pending ? new Date(pending.exportedAt).toLocaleDateString() : ''

  return (
    <section aria-labelledby="data-title" className="mt-10">
      <h2 id="data-title" className="font-serif text-2xl font-bold">
        Your data
      </h2>
      <p className="mt-2 text-muted">
        Everything stays on this device. Backups are files you make yourself,
        and there is no sync.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={button}
          onClick={() => save(makeBackup(profileManager, { named: many }))}
        >
          {many ? 'Export this profile' : 'Export my data'}
        </button>
        {many && (
          <button
            type="button"
            className={button}
            onClick={() => save(makeAllProfilesBackup(profileManager))}
          >
            Export all profiles
          </button>
        )}
        <button
          type="button"
          className={button}
          onClick={() => fileInput.current?.click()}
        >
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          data-testid="import-file"
          aria-label="Backup file to import"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`mt-3 ${message.error ? 'font-semibold' : 'text-muted'}`}
        >
          {message.text}
        </p>
      )}

      {pending?.kind === 'profile' && !confirmReplace && (
        <div
          role="alertdialog"
          aria-label="Import this backup"
          className="mt-4 rounded-card border border-line bg-surface p-4"
        >
          <p>
            This backup
            {pending.name ? ` is for “${pending.name}” and` : ''} was made{' '}
            {when}. What would you like to do with it?
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              className={danger}
              disabled={
                busy || snapshot.profiles.length >= MAX_READING_PROFILES
              }
              onClick={() =>
                finish(addBackupAsProfile(profileManager, pending), () =>
                  say('Added the backup as a new profile.'),
                )
              }
            >
              Add as a new profile
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setConfirmReplace(true)}
            >
              Replace this profile
            </button>
            <button type="button" className={button} onClick={cancelImport}>
              Cancel
            </button>
          </div>
          {snapshot.profiles.length >= MAX_READING_PROFILES && (
            <p className="mt-2 text-sm text-muted">
              You already have {MAX_READING_PROFILES} profiles, the most this
              device keeps. Delete one to add another.
            </p>
          )}
        </div>
      )}

      {pending?.kind === 'profile' && confirmReplace && (
        <div
          role="alertdialog"
          aria-label="Replace this profile"
          className="mt-4 rounded-card border border-line bg-surface p-4"
        >
          <p>
            Replace everything {openName} has read, Dog-eared and taught Twice
            Told with this backup? What {openName} has now will be overwritten.
            Other profiles are not touched.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() =>
                finish(
                  replaceProfileFromBackup(profileManager, pending),
                  () => {
                    say('Backup restored.')
                    void navigate('/')
                  },
                )
              }
            >
              Yes, replace this profile
            </button>
            <button type="button" className={button} onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pending?.kind === 'all' && (
        <div
          role="alertdialog"
          aria-label="Restore this backup"
          className="mt-4 rounded-card border border-line bg-surface p-4"
        >
          <p>
            Replace everything on this device with this backup of{' '}
            {pending.profiles.length} profile
            {pending.profiles.length === 1 ? '' : 's'} (made {when})? Every
            profile here now will be overwritten.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() =>
                finish(
                  replaceEverythingFromBackup(profileManager, pending),
                  () => {
                    say('Backup restored.')
                    void navigate('/')
                  },
                )
              }
            >
              Yes, replace everything
            </button>
            <button type="button" className={button} onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        {!deleting ? (
          <button
            type="button"
            className={button}
            onClick={() => setDeleting(true)}
          >
            Delete all my data
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-label="Delete all my data"
            className="rounded-card border border-line bg-surface p-4"
          >
            <p>
              This wipes {many ? 'every profile — ' : ''}your taste, library,
              progress, settings and every saved book from this device. It
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
                className="mt-1 min-h-11 w-full rounded-lg border border-line bg-page px-3"
              />
            </label>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className={danger}
                disabled={typed !== DELETE_WORD || busy}
                onClick={onDelete}
              >
                Delete everything
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setDeleting(false)
                  setTyped('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
