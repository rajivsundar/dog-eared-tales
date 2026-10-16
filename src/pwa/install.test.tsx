import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallControl } from './InstallControl'
import {
  installMode,
  isIosSafari,
  isStandalone,
  listenForInstallPrompt,
  promptInstall,
  setDeferredPromptForTest,
} from './install'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

function fakePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome })
  return event
}

function setEnvironment(options: { standalone?: boolean; userAgent?: string }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && !!options.standalone,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: options.userAgent ?? ANDROID_CHROME,
  })
}

beforeEach(() => setDeferredPromptForTest(null))
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'userAgent')
})

describe('what to show', () => {
  it('shows a button when the browser gave us an install prompt', () => {
    expect(
      installMode({ standalone: false, hasPrompt: true, ios: false }),
    ).toBe('button')
  })

  it('shows Share → Add to Home Screen steps on iPhone and iPad Safari', () => {
    expect(
      installMode({ standalone: false, hasPrompt: false, ios: true }),
    ).toBe('ios')
  })

  it('shows nothing when there is nothing to offer', () => {
    expect(
      installMode({ standalone: false, hasPrompt: false, ios: false }),
    ).toBe('hidden')
  })

  it('never shows anything when the app is already installed', () => {
    for (const hasPrompt of [true, false]) {
      for (const ios of [true, false]) {
        expect(installMode({ standalone: true, hasPrompt, ios })).toBe('hidden')
      }
    }
  })
})

describe('detecting the environment', () => {
  it('knows when the app is running installed (display-mode: standalone)', () => {
    setEnvironment({ standalone: true })
    expect(isStandalone()).toBe(true)
    setEnvironment({ standalone: false })
    expect(isStandalone()).toBe(false)
  })

  it('knows iOS "standalone" too (opened from the home screen)', () => {
    setEnvironment({ standalone: false })
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    })
    expect(isStandalone()).toBe(true)
    Reflect.deleteProperty(navigator, 'standalone')
  })

  it('recognises iPhone and iPad Safari, but not other browsers', () => {
    const nav = (userAgent: string, platform = '', maxTouchPoints = 0) => ({
      userAgent,
      platform,
      maxTouchPoints,
    })
    expect(isIosSafari(nav(IPHONE))).toBe(true)
    expect(
      isIosSafari(
        nav(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'MacIntel',
          5,
        ),
      ),
    ).toBe(true) // an iPad that says it is a Mac
    expect(isIosSafari(nav(IPHONE_CHROME))).toBe(false)
    expect(isIosSafari(nav(ANDROID_CHROME))).toBe(false)
    expect(
      isIosSafari(
        nav('Mozilla/5.0 (Macintosh) Safari/605.1.15', 'MacIntel', 0),
      ),
    ).toBe(false) // a real Mac
  })
})

describe('the install control', () => {
  it('shows "Install Twice Told" once the browser offers the prompt, and uses it', async () => {
    setEnvironment({ standalone: false })
    render(<InstallControl />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    const event = fakePrompt()
    act(() => setDeferredPromptForTest(event))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Install Twice Told' }),
    )
    await act(async () => {})
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('captures the beforeinstallprompt event, keeping the browser from showing its own bar', async () => {
    setEnvironment({ standalone: false })
    listenForInstallPrompt(window)
    render(<InstallControl />)
    const event = fakePrompt()
    const preventDefault = vi.spyOn(event, 'preventDefault')
    act(() => {
      window.dispatchEvent(event)
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: 'Install Twice Told' }),
    ).toBeInTheDocument()
    expect(await promptInstall()).toBe('accepted')
    expect(await promptInstall()).toBe('unavailable')
  })

  it('hides the button when running standalone, even with a prompt available', () => {
    setEnvironment({ standalone: true })
    setDeferredPromptForTest(fakePrompt())
    render(<InstallControl />)
    expect(
      screen.queryByRole('button', { name: 'Install Twice Told' }),
    ).not.toBeInTheDocument()
    expect(document.body).toHaveTextContent('')
  })

  it('shows Share → Add to Home Screen instructions on iPhone Safari', () => {
    setEnvironment({ standalone: false, userAgent: IPHONE })
    render(<InstallControl />)
    expect(screen.getByTestId('ios-install')).toHaveTextContent(
      'tap the Share button, then choose Add to Home Screen',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides the iOS instructions when already added to the home screen', () => {
    setEnvironment({ standalone: true, userAgent: IPHONE })
    render(<InstallControl />)
    expect(screen.queryByTestId('ios-install')).not.toBeInTheDocument()
  })

  it('shows nothing on a browser that cannot install', () => {
    setEnvironment({ standalone: false })
    render(<InstallControl />)
    expect(document.body).toHaveTextContent('')
  })
})
