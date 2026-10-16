// The reading fonts are packaged with the app (npm packages from Fontsource, all under the SIL
// Open Font License). The files are served from our own site, so there is no font CDN and the
// fonts work offline. A font file is only downloaded when a book actually uses that font.
import literataLatinNormal from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url'
import literataLatinItalic from '@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url'
import literataExtNormal from '@fontsource-variable/literata/files/literata-latin-ext-wght-normal.woff2?url'
import literataExtItalic from '@fontsource-variable/literata/files/literata-latin-ext-wght-italic.woff2?url'
import atkinson400 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url'
import atkinson400Italic from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url'
import atkinson700 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url'
import atkinson700Italic from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-italic.woff2?url'
import dyslexic400 from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url'
import dyslexic400Italic from '@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url'
import dyslexic700 from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url'
import dyslexic700Italic from '@fontsource/opendyslexic/files/opendyslexic-latin-700-italic.woff2?url'

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

interface Face {
  family: string
  url: string
  style: 'normal' | 'italic'
  weight: string
  range?: string
  format: string
}

const FACES: Face[] = [
  {
    family: 'Literata Variable',
    url: literataLatinNormal,
    style: 'normal',
    weight: '200 900',
    range: LATIN,
    format: 'woff2-variations',
  },
  {
    family: 'Literata Variable',
    url: literataExtNormal,
    style: 'normal',
    weight: '200 900',
    range: LATIN_EXT,
    format: 'woff2-variations',
  },
  {
    family: 'Literata Variable',
    url: literataLatinItalic,
    style: 'italic',
    weight: '200 900',
    range: LATIN,
    format: 'woff2-variations',
  },
  {
    family: 'Literata Variable',
    url: literataExtItalic,
    style: 'italic',
    weight: '200 900',
    range: LATIN_EXT,
    format: 'woff2-variations',
  },
  {
    family: 'Atkinson Hyperlegible',
    url: atkinson400,
    style: 'normal',
    weight: '400',
    format: 'woff2',
  },
  {
    family: 'Atkinson Hyperlegible',
    url: atkinson400Italic,
    style: 'italic',
    weight: '400',
    format: 'woff2',
  },
  {
    family: 'Atkinson Hyperlegible',
    url: atkinson700,
    style: 'normal',
    weight: '700',
    format: 'woff2',
  },
  {
    family: 'Atkinson Hyperlegible',
    url: atkinson700Italic,
    style: 'italic',
    weight: '700',
    format: 'woff2',
  },
  {
    family: 'OpenDyslexic',
    url: dyslexic400,
    style: 'normal',
    weight: '400',
    format: 'woff2',
  },
  {
    family: 'OpenDyslexic',
    url: dyslexic400Italic,
    style: 'italic',
    weight: '400',
    format: 'woff2',
  },
  {
    family: 'OpenDyslexic',
    url: dyslexic700,
    style: 'normal',
    weight: '700',
    format: 'woff2',
  },
  {
    family: 'OpenDyslexic',
    url: dyslexic700Italic,
    style: 'italic',
    weight: '700',
    format: 'woff2',
  },
]

/**
 * @font-face rules for every packaged reading font. The book is shown inside a frame that is not
 * at our page's address, so the file addresses must be complete ("https://…") rather than "/assets/…".
 */
export function fontFaceCss(
  baseUrl: string = globalThis.location?.href ?? 'http://localhost/',
): string {
  return FACES.map(
    ({ family, url, style, weight, range, format }) => `@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url(${new URL(url, baseUrl).href}) format('${format}');${range ? `\n  unicode-range: ${range};` : ''}
}`,
  ).join('\n')
}
