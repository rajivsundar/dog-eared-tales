import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import art from './fall'

/** The artwork's source files (not the tests), read as text. */
const sources = import.meta.glob(
  ['./*.ts', './*.tsx', '!./*.test.ts', '!./*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
})

function reducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matches && query.includes('prefers-reduced-motion'),
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

describe('the art budget', () => {
  it('adds under 30 KB in total (source files of all seasons)', () => {
    const files = Object.entries(sources)
    const total = files.reduce((sum, [, text]) => sum + text.length, 0)
    expect(Object.keys(sources).some((f) => f.endsWith('fall.tsx'))).toBe(true)
    expect(total).toBeLessThan(30 * 1024)
    // No photos or stock images: the art is inline SVG, with no image files or external links.
    const all = files.map(([, text]) => text).join('\n')
    expect(all).not.toMatch(/\.(png|jpe?g|gif|webp)\b/)
    expect(all).not.toMatch(/https?:\/\//)
  })
})

describe('the falling leaves', () => {
  it('animate by default', () => {
    reducedMotion(false)
    render(<art.Leaves />)
    const leaves = screen.getByTestId('season-leaves')
    expect(leaves).toHaveAttribute('data-motion', 'animated')
    expect(leaves.querySelectorAll('svg').length).toBeGreaterThanOrEqual(5)
    expect(leaves).toHaveAttribute('aria-hidden', 'true')
  })

  it('stand still when the reader prefers reduced motion', () => {
    reducedMotion(true)
    render(<art.Leaves />)
    const leaves = screen.getByTestId('season-leaves')
    expect(leaves).toHaveAttribute('data-motion', 'static')
    // The stylesheet turns the animation off for that setting, in both ways.
    const css = leaves.querySelector('style')!.textContent!
    expect(css).toMatch(/\[data-motion='static'\] \.tt-leaf \{ animation: none/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/,
    )
  })

  it('pause while the tab is hidden, and go on when it is back', () => {
    reducedMotion(false)
    render(<art.Leaves />)
    const leaves = screen.getByTestId('season-leaves')
    expect(leaves).toHaveAttribute('data-paused', 'false')
    expect(leaves.querySelector('style')!.textContent).toMatch(
      /\[data-paused='true'\] \.tt-leaf \{ animation-play-state: paused/,
    )
    const set = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: state,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    act(() => set('hidden'))
    expect(leaves).toHaveAttribute('data-paused', 'true')
    act(() => set('visible'))
    expect(leaves).toHaveAttribute('data-paused', 'false')
  })
})

describe('the other drawings', () => {
  it('the chair scene and the heading leaf are decorative', () => {
    reducedMotion(false)
    render(
      <>
        <art.Scene />
        <h2>
          <art.Accent />
          Your Shortlist
        </h2>
      </>,
    )
    expect(screen.getByTestId('season-scene')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    // The heading's name is just its words.
    expect(
      screen.getByRole('heading', { name: 'Your Shortlist' }),
    ).toBeInTheDocument()
  })

  it('use the theme colours, so they read on Paper, Sepia, Night and Black', () => {
    const source = Object.entries(sources).find(([f]) =>
      f.endsWith('fall.tsx'),
    )![1]
    expect(source).toMatch(/stroke-ink/)
    expect(source).toMatch(/fill-page/)
    expect(source).toMatch(/fill-accent/)
    // The only fixed colours are the lamp light and the autumn leaves.
    const fixed = new Set(source.match(/#[0-9a-fA-F]{6}\b/g))
    expect(fixed.size).toBeLessThanOrEqual(10)
  })
})
