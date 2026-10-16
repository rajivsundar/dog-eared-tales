import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { clearTextCache } from '../../pwa/textCache'
import { type BackupFile, BackupError, dataStore } from '../../stores'
import {
  DELETE_WORD,
  deleteAllData,
  downloadTextFile,
  makeBackup,
  readBackupFile,
  restoreBackup,
} from './dataActions'

const button =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const danger =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

/** Settings → Your data: export a backup, import one, or delete everything. */
export function DataSection() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState<{
    text: string
    error: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const say = (text: string, error = false): void => setMessage({ text, error })

  const onExport = (): void => {
    setMessage(null)
    makeBackup(dataStore)
      .then(({ filename, text }) => {
        downloadTextFile(filename, text)
        say(`Saved ${filename}.`)
      })
      .catch((error: unknown) => {
        console.error(error)
        say('We couldn’t make the backup.', true)
      })
  }

  const onFile = (file: File | undefined): void => {
    setMessage(null)
    setPending(null)
    if (!file) return
    readBackupFile(file)
      .then(setPending)
      .catch((error: unknown) => {
        say(
          error instanceof BackupError
            ? error.message
            : 'We couldn’t read that file.',
          true,
        )
      })
    if (fileInput.current) fileInput.current.value = ''
  }

  const onRestore = (): void => {
    if (!pending || busy) return
    setBusy(true)
    restoreBackup(dataStore, pending)
      .then(() => {
        setPending(null)
        say('Backup restored.')
        navigate('/')
      })
      .catch((error: unknown) => {
        console.error(error)
        say('We couldn’t restore that backup. Nothing was changed.', true)
      })
      .finally(() => setBusy(false))
  }

  const onDelete = (): void => {
    if (typed !== DELETE_WORD || busy) return
    setBusy(true)
    deleteAllData({ data: dataStore, clearTexts: clearTextCache })
      .then(() => navigate('/welcome', { replace: true }))
      .catch((error: unknown) => {
        console.error(error)
        say('We couldn’t delete everything.', true)
        setBusy(false)
      })
  }

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
        <button type="button" className={button} onClick={onExport}>
          Export my data
        </button>
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

      {pending && (
        <div
          role="alertdialog"
          aria-label="Restore this backup"
          className="mt-4 rounded-card border border-line bg-surface p-4"
        >
          <p>
            Replace everything on this device with this backup (made{' '}
            {new Date(pending.exportedAt).toLocaleDateString()})? What is here
            now will be overwritten.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={onRestore}
            >
              Yes, replace my data
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setPending(null)}
            >
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
              This wipes your taste, library, progress, settings and every saved
              book from this device. It cannot be undone.
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
