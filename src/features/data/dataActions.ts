import {
  type AllBackup,
  type BackupFile,
  type ProfileBackup,
  type ProfileManager,
  parseBackup,
} from '../../stores'

const dateOf = (now: Date): string => {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** "dog-eared-tales-backup-2026-10-16.json", using the local date. With a profile name: "…-backup-sam-2026-10-16.json". */
export function backupFileName(now: Date = new Date(), label?: string): string {
  const slug = (label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `dog-eared-tales-backup-${slug ? `${slug}-` : ''}${dateOf(now)}.json`
}

/** "dog-eared-tales-all-profiles-2026-10-16.json". */
export function allProfilesFileName(now: Date = new Date()): string {
  return `dog-eared-tales-all-profiles-${dateOf(now)}.json`
}

/** The open profile as one JSON file's text, and the name to save it under. */
export async function makeBackup(
  manager: Pick<ProfileManager, 'exportProfile'>,
  options: { named?: boolean; now?: Date } = {},
): Promise<{ filename: string; text: string }> {
  const backup = await manager.exportProfile()
  return {
    filename: backupFileName(
      options.now,
      options.named ? backup.name : undefined,
    ),
    text: JSON.stringify(backup, null, 2),
  }
}

/** Every profile on the device as one JSON file's text, and the name to save it under. */
export async function makeAllProfilesBackup(
  manager: Pick<ProfileManager, 'exportAllProfiles'>,
  now: Date = new Date(),
): Promise<{ filename: string; text: string }> {
  const backup = await manager.exportAllProfiles()
  return {
    filename: allProfilesFileName(now),
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

/** Adds a one-profile backup as a new profile. */
export function addBackupAsProfile(
  manager: Pick<ProfileManager, 'importAsNewProfile'>,
  backup: ProfileBackup,
) {
  return manager.importAsNewProfile(backup)
}

/** Replaces the open profile's reading with a one-profile backup. */
export async function replaceProfileFromBackup(
  manager: Pick<ProfileManager, 'replaceProfileWith'>,
  backup: ProfileBackup,
): Promise<void> {
  await manager.replaceProfileWith(backup)
}

/** Replaces every profile on the device with an all-profiles backup. */
export async function replaceEverythingFromBackup(
  manager: Pick<ProfileManager, 'replaceEverythingWith'>,
  backup: AllBackup,
): Promise<void> {
  await manager.replaceEverythingWith(backup)
}

/** Wipes every profile and the saved books, and starts a fresh "Me". */
export async function deleteAllData(deps: {
  everything: () => Promise<void>
  clearTexts: () => Promise<void>
}): Promise<void> {
  await deps.everything()
  await deps.clearTexts()
}

/** The word the reader must type before everything is deleted. */
export const DELETE_WORD = 'DELETE'
