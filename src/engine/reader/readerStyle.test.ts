import { describe, expect, it } from 'vitest'
import {
  THEME_COLORS,
  TEXT_SIZES,
  contrastRatio,
  readerCss,
  resolveTheme,
  textSizePx,
} from './readerStyle'

describe('themes', () => {
  it('gives every theme body text contrast of at least 7:1', () => {
    for (const [name, colors] of Object.entries(THEME_COLORS)) {
      expect(
        contrastRatio(colors.text, colors.background),
        name,
      ).toBeGreaterThanOrEqual(7)
    }
  })

  it('measures contrast correctly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1)
  })

  it('turns "system" into paper in light mode and night in dark mode', () => {
    expect(resolveTheme('system', false)).toBe('paper')
    expect(resolveTheme('system', true)).toBe('night')
    expect(resolveTheme('sepia', true)).toBe('sepia')
  })
})

describe('text size steps', () => {
  it('maps steps 1 to 10 to growing sizes with step 5 as the default', () => {
    expect(TEXT_SIZES).toHaveLength(10)
    expect([...TEXT_SIZES]).toEqual([...TEXT_SIZES].sort((a, b) => a - b))
    expect(textSizePx(5)).toBe(18)
  })

  it('keeps out-of-range steps inside 1 to 10', () => {
    expect(textSizePx(0)).toBe(TEXT_SIZES[0])
    expect(textSizePx(99)).toBe(TEXT_SIZES[9])
  })
})

describe('the reader stylesheet', () => {
  const faces = '@font-face { font-family: "Literata Variable"; }'

  it('applies the font, size and theme colours', () => {
    const css = readerCss(
      { font: 'literata', sizeStep: 8, theme: 'night' },
      { prefersDark: false, fontFaceCss: faces },
    )
    expect(css).toContain(faces)
    expect(css).toContain("'Literata Variable'")
    expect(css).toContain(`font-size: ${textSizePx(8)}px`)
    expect(css).toContain(THEME_COLORS.night.background)
    expect(css).toContain(THEME_COLORS.night.text)
    expect(css).toContain('color-scheme: dark')
    // foliate-js paints the margins beside the page from this variable.
    expect(css).toContain(`--theme-bg-color: ${THEME_COLORS.night.background}`)
  })

  it('follows the device setting for the system theme', () => {
    const light = readerCss(
      { font: 'systemSerif', sizeStep: 5, theme: 'system' },
      { prefersDark: false, fontFaceCss: '' },
    )
    const dark = readerCss(
      { font: 'systemSerif', sizeStep: 5, theme: 'system' },
      { prefersDark: true, fontFaceCss: '' },
    )
    expect(light).toContain(THEME_COLORS.paper.background)
    expect(dark).toContain(THEME_COLORS.night.background)
  })

  it('does not load fonts from the internet', () => {
    const css = readerCss(
      { font: 'literata', sizeStep: 5, theme: 'paper' },
      { prefersDark: false, fontFaceCss: faces },
    )
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(css).not.toMatch(/@import/)
  })
})
