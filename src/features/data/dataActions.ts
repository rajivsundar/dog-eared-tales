import { type BackupFile, type DataStore, parseBackup } from '../../stores'

/** "twice-told-backup-2026-10-16.json", using the local date. */
export function backupFileName(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `twice-told-backup-${now.getFullYear()}-${month}-${day}.json`
}

/** Everything on this device as one JSON file's text, and the name to save it under. */
export async function makeBackup(
  data: Pick<DataStore, 'exportAll'>,
  now: Date = new Date(),
): Promise<{ filename: string; text: string }> {
  const backup = await data.exportAll()
  return {
    filename: backupFileName(now),
    text: JSON.stringify(backup, null, 2),
  }
}

/** Saves text as a file download. */
export function downloadTextFile(
  filename: string,
  text: string,
  env: {
    document: Document
    URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>
  } = { document, URL },
): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = env.URL.createObjectURL(blob)
  const link = env.document.createElement('a')
  link.href = url
  link.download = filename
  env.document.body.appendChild(link)
  link.click()
  link.remove()
  env.URL.revokeObjectURL(url)
}

/** Reads a chosen file as a backup. Throws a BackupError (with a plain-English message) if it cannot be used. */
export async function readBackupFile(
  file: Pick<File, 'text'>,
): Promise<BackupFile> {
  return parseBackup(await file.text())
}

/** Replaces everything on this device with the backup. */
export async function restoreBackup(
  data: Pick<DataStore, 'importAll'>,
  backup: BackupFile,
): Promise<void> {
  await data.importAll(backup)
}

/** Wipes every store and the saved books. */
export async function deleteAllData(deps: {
  data: Pick<DataStore, 'deleteAll'>
  clearTexts: () => Promise<void>
}): Promise<void> {
  await deps.data.deleteAll()
  await deps.clearTexts()
}

/** The word the reader must type before everything is deleted. */
export const DELETE_WORD = 'DELETE'
