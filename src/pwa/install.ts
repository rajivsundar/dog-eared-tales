import { useEffect, useState } from 'react'

/** The install prompt Chrome and Edge give us (Android and desktop). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())

/** Starts listening. Call once, early, because the browser sends the event only once. */
export function listenForInstallPrompt(win: Window = window): void {
  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  win.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** True when the app is running installed (opened from the home screen or app list). */
export function isStandalone(
  win: Pick<Window, 'matchMedia'> & { navigator: Navigator } = window,
): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean }
  return (
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  )
}

/** iPhone or iPad Safari, where installing means Share → Add to Home Screen. */
export function isIosSafari(
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
    platform?: string
  } = navigator,
): boolean {
  const ua = nav.userAgent
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac with a touch screen.
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export type InstallMode = 'hidden' | 'button' | 'ios'

/** What to show: nothing when already installed, a button when the browser gave us a prompt, or iOS steps. */
export function installMode(state: {
  standalone: boolean
  hasPrompt: boolean
  ios: boolean
}): InstallMode {
  if (state.standalone) return 'hidden'
  if (state.hasPrompt) return 'button'
  if (state.ios) return 'ios'
  return 'hidden'
}

/** Shows the browser's install prompt. */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  const prompt = deferred
  if (!prompt) return 'unavailable'
  deferred = null
  notify()
  await prompt.prompt()
  return (await prompt.userChoice).outcome
}

export function useInstallMode(): InstallMode {
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = (): void => setTick((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return installMode({
    standalone: isStandalone(),
    hasPrompt: deferred !== null,
    ios: isIosSafari(),
  })
}

/** For tests. */
export function setDeferredPromptForTest(event: unknown): void {
  deferred = event as BeforeInstallPromptEvent | null
  notify()
}
