import { promptInstall, useInstallMode } from './install'

/**
 * The install option: an "Install Dog-Eared Tales" button (Android, desktop Chrome and Edge) or short
 * Share → Add to Home Screen steps (iPhone and iPad Safari). Shows nothing when the app is
 * already installed, or when there is no way to install.
 */
export function InstallControl() {
  const mode = useInstallMode()
  if (mode === 'hidden') return null
  if (mode === 'ios') {
    return (
      <p data-testid="ios-install">
        To install: tap the Share button, then choose Add to Home Screen.
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="inline-flex min-h-11 items-center rounded-full border-2 border-current px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      Install Dog-Eared Tales
    </button>
  )
}
