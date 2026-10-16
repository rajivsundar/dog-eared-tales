import type { ReaderStyle } from './types'

/** Text size in pixels for each step from 1 to 10. Step 5 is the default. */
export const TEXT_SIZES = [14, 15, 16, 17, 18, 20, 22, 24, 27, 30] as const

export type ConcreteTheme = 'paper' | 'sepia' | 'night' | 'black'

export interface ThemeColors {
  background: string
  text: string
}

export const THEME_COLORS: Record<ConcreteTheme, ThemeColors> = {
  paper: { background: '#fbf8f2', text: '#1c1a17' },
  sepia: { background: '#f3e7cf', text: '#33281a' },
  night: { background: '#1b1c1f', text: '#e7e3da' },
  black: { background: '#000000', text: '#e9e9e9' },
}

const FONT_STACKS: Record<ReaderStyle['font'], string> = {
  literata: "'Literata Variable', Georgia, 'Times New Roman', serif",
  // Packaged with the app: see fonts.ts.
  atkinson: "'Atkinson Hyperlegible', system-ui, sans-serif",
  opendyslexic: "'OpenDyslexic', system-ui, sans-serif",
  systemSerif: "Georgia, 'Times New Roman', serif",
}

/** "system" means Paper in light mode and Night in dark mode. */
export function resolveTheme(
  theme: ReaderStyle['theme'],
  prefersDark: boolean,
): ConcreteTheme {
  if (theme === 'system') return prefersDark ? 'night' : 'paper'
  return theme
}

export function textSizePx(sizeStep: number): number {
  const step = Math.min(10, Math.max(1, Math.round(sizeStep)))
  return TEXT_SIZES[step - 1]
}

function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio between two #rrggbb colours. US-603 asks for at least 7:1. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

export interface StyleOptions {
  prefersDark: boolean
  /** @font-face rules for the fonts that are packaged with the app. */
  fontFaceCss: string
}

/** The CSS that foliate-js puts inside every chapter file on screen. */
export function readerCss(
  style: ReaderStyle,
  { prefersDark, fontFaceCss }: StyleOptions,
): string {
  const colors = THEME_COLORS[resolveTheme(style.theme, prefersDark)]
  const dark =
    colors.background === '#1b1c1f' || colors.background === '#000000'
  const size = textSizePx(style.sizeStep)
  return `${fontFaceCss}
html { color-scheme: ${dark ? 'dark' : 'light'}; font-size: ${size}px !important; --theme-bg-color: ${colors.background}; }
html, body { background: ${colors.background} !important; color: ${colors.text} !important; }
body { font-family: ${FONT_STACKS[style.font]} !important; line-height: 1.6 !important; }
body :where(p, div, span, li, td, blockquote, pre, em, i, b, strong, small, sup, sub, h1, h2, h3, h4, h5, h6) {
  font-family: inherit !important;
  color: inherit !important;
}
a { color: inherit !important; }
img, svg { max-width: 100% !important; height: auto !important; }
`
}
