// Builds the catalog from content/sources.csv and the EPUBs in content/raw/.
// Run with: npm run catalog
// Writes public/catalog/catalog.json, public/texts/pg-<number>.epub and
// public/covers/<id>.svg. Those folders are generated and are not committed.
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = path.join(ROOT, 'content', 'raw')
const SOURCES_CSV = path.join(ROOT, 'content', 'sources.csv')
const CURATION_JSON = path.join(ROOT, 'content', 'curation.json')
const OUT_CATALOG = path.join(ROOT, 'public', 'catalog')
const OUT_TEXTS = path.join(ROOT, 'public', 'texts')
const OUT_COVERS = path.join(ROOT, 'public', 'covers')

const WORDS_PER_MINUTE = 238
const LICENSE = 'Project Gutenberg License'
/** The media type of an EPUB 2 table of contents. */
const NCX_TYPE = 'application/x-dtbncx+xml'

export type LengthClass = 'under10' | '10to30' | '30to60' | '60plus'

export const GENRES = [
  'horror',
  'mystery',
  'ghost story',
  'satire',
  'humour',
  'romance',
  'adventure',
  'science fiction',
  'literary',
  'philosophy',
  'social criticism',
  'politics',
  'history',
  'memoir',
  'spirituality',
  'self-help',
  'science',
  'war',
  'fantasy',
] as const
export const MOODS = [
  'cozy',
  'eerie',
  'funny',
  'romantic',
  'thoughtful',
  'adventurous',
  'melancholy',
  'uplifting',
  'tense',
  'whimsical',
  'dark',
  'hopeful',
] as const
export const CONTENT_NOTES = [
  'death',
  'grief',
  'violence',
  'suicide',
  'illness',
  'cruelty',
  'racism',
  'animal harm',
  'mental illness',
] as const
export const ERA_BANDS = [
  'pre-1800',
  '1800-1849',
  '1850-1899',
  '1900-1930',
] as const
export const FORMS = ['story', 'novelette', 'novella', 'essay'] as const

export type Genre = (typeof GENRES)[number]
export type Mood = (typeof MOODS)[number]
export type ContentNote = (typeof CONTENT_NOTES)[number]
export type EraBand = (typeof ERA_BANDS)[number]
export type Form = (typeof FORMS)[number]
export type ReadingBand = 'easy' | 'medium' | 'challenging'

export interface ReadingLevel {
  /** Flesch-Kincaid grade of the story's own text, rounded to a whole number. */
  grade: number
  band: ReadingBand
}

/** What content/curation.json holds for each entry. */
export interface Curation {
  year: number
  eraBand: EraBand
  form: Form
  genres: Genre[]
  moods: Mood[]
  contentNotes: ContentNote[]
  /** 20 words or fewer. */
  hook: string
  /** 60 words or fewer. */
  blurb: string
  generatedBy: string
  reviewed: boolean
}

export interface CatalogEntry extends Curation {
  id: string
  title: string
  author: string
  language: string
  /** The EPUB's own title. The app shows it as "from <book>" for collection entries. */
  bookTitle: string
  isCollection: boolean
  wordCount: number
  readingMinutes: number
  lengthClass: LengthClass
  readingLevel: ReadingLevel
  firstLine: string
  textUrl: string
  coverUrl: string
  /**
   * Where the story starts inside the EPUB. For a single work, the first heading after the
   * Project Gutenberg START line, so the licence notice is skipped.
   */
  startHref: string
  /**
   * Where the story ends. For a collection story, where the next story starts. For a single work,
   * the Project Gutenberg licence section, which holds the END line.
   */
  endHref: string
  sha256: string
  source: string
  sourceUrl: string
  license: string
}

export type BaseEntry = Omit<CatalogEntry, keyof Curation>

export interface BuildResult {
  /** The entries that ship: those with a curation record marked reviewed: true. */
  entries: CatalogEntry[]
  /** Every row of sources.csv, built and checked, whether or not it ships. */
  base: BaseEntry[]
  /** Rows held back because they have no reviewed curation record yet. */
  skipped: BaseEntry[]
  /** The text range of every entry (by id), for tests. */
  rangeText: Record<string, string>
  /** Unique EPUBs to publish (only for entries that ship): Gutenberg number -> source file. */
  epubs: Map<string, string>
}

class CatalogError extends Error {}

function fail(message: string): never {
  throw new CatalogError(message)
}

// ---------------------------------------------------------------- CSV

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows.filter((r) => r.some((f) => f !== ''))
  if (!header) fail('content/sources.csv is empty')
  return body.map((r) =>
    Object.fromEntries(header.map((name, i) => [name, r[i] ?? ''])),
  )
}

// ---------------------------------------------------------------- EPUB

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1].toLowerCase() === 'x'
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10)
      return String.fromCodePoint(code)
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'big',
  'cite',
  'code',
  'em',
  'font',
  'i',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
])

/** Turns XHTML into plain text. Paragraphs and headings become separate lines.
 * Every id or name attribute leaves a marker, so an href can be found in the text. */
function htmlToText(html: string, filePath: string): string {
  let s = html.replace(/<(head|style|script)\b[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*\?>/g, '')
  // Line breaks in the source are just spacing. Only tags (and blank lines in <pre>) end a paragraph.
  s = s
    .split(/(<pre\b[\s\S]*?<\/pre>)/i)
    .map((part) =>
      /^<pre\b/i.test(part)
        ? part
            .replace(/\n[ \t]*\n/g, '\u0003')
            .replace(/\n/g, ' ')
            .split('\u0003')
            .join('\n')
        : part.replace(/\s*\n\s*/g, ' '),
    )
    .join('')

  // Lines inside headings, tables, quotes and centred or poem blocks are marked
  // with \u0001 so the first-sentence search skips them (titles, epigraphs).
  let out = ''
  let flagged = 0
  const open: boolean[] = []
  const lineBreak = (): string => (flagged > 0 ? '\n\u0001' : '\n')
  let last = 0
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][^\s>/]*)([^>]*)>/g)) {
    out += s.slice(last, m.index)
    last = (m.index ?? 0) + m[0].length
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const attrs = m[3]
    if (!closing) {
      for (const x of attrs.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) {
        out += `\0${filePath}#${x[1]}\0`
      }
    }
    if (INLINE_TAGS.has(tag)) continue
    const selfClosing = attrs.trimEnd().endsWith('/')
    if (/^h[1-6]$|^table$|^blockquote$|^[uod]l$/.test(tag)) {
      if (!selfClosing) flagged = Math.max(0, flagged + (closing ? -1 : 1))
    } else if ((tag === 'p' || tag === 'div') && !selfClosing) {
      if (closing) {
        if (open.pop()) flagged = Math.max(0, flagged - 1)
      } else {
        const marked =
          /class=["'][^"']*\b(poem|epigraph|quote|verse|dedication|center|right|caption|fig\w*|toc|h[1-6])\b/i.test(
            attrs,
          ) || /text-align:\s*(right|center)/i.test(attrs)
        open.push(marked)
        if (marked) flagged++
      }
    }
    out += lineBreak()
  }
  out += s.slice(last)
  return decodeEntities(out).replace(/[ \t\f\v\u00a0]+/g, ' ')
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}=["']([^"']*)["']`).exec(tag)
  return m ? decodeEntities(m[1]) : undefined
}

function dcField(opf: string, name: string): string {
  const m = new RegExp(`<dc:${name}\\b[^>]*>([\\s\\S]*?)</dc:${name}>`).exec(
    opf,
  )
  return m
    ? decodeEntities(m[1].replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
    : ''
}

function resolvePath(base: string, href: string): string {
  const clean = decodeURIComponent(href)
  return path.posix.normalize(path.posix.join(base, clean))
}

interface Epub {
  file: string
  title: string
  author: string
  language: string
  /** Text of the whole book in reading order, with href markers. */
  stream: string
  /** Index in the stream of the Project Gutenberg licence section. */
  licenseAt: number
  /** The href of the licence section. */
  licenseHref: string
}

function readEpub(file: string): Epub {
  const files = unzipSync(
    new Uint8Array(readFileSync(path.join(RAW_DIR, file))),
  )
  const read = (name: string): string => {
    const data = files[name]
    if (!data) fail(`${file}: missing ${name} inside the EPUB`)
    return strFromU8(data)
  }
  const container = read('META-INF/container.xml')
  const opfPath = /full-path=["']([^"']+)["']/.exec(container)?.[1]
  if (!opfPath) fail(`${file}: no package file listed in container.xml`)
  const opf = read(opfPath)
  const base = path.posix.dirname(opfPath)

  const manifest = new Map<
    string,
    { href: string; props: string; type: string }
  >()
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = attr(m[0], 'id')
    const href = attr(m[0], 'href')
    if (id && href)
      manifest.set(id, {
        href: resolvePath(base, href),
        props: attr(m[0], 'properties') ?? '',
        type: attr(m[0], 'media-type') ?? '',
      })
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*>/g)].map((m) => {
    const item = manifest.get(attr(m[0], 'idref') ?? '')
    if (!item) fail(`${file}: spine refers to a missing manifest item`)
    return item.href
  })

  let stream = ''
  for (const href of spine) {
    stream += `\0${href}\0` + htmlToText(read(href), href)
  }

  // The licence section. EPUB 3 books list it in the table of contents ("...LICENSE").
  // EPUB 2 books have no such entry, so use the Project Gutenberg footer heading, and failing
  // that the file that holds the "*** END OF" line.
  let licenseHref: string | undefined
  const nav = [...manifest.values()].find((i) =>
    i.props.split(/\s+/).includes('nav'),
  )
  if (nav) {
    const navDir = path.posix.dirname(nav.href)
    for (const m of read(nav.href).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const label = decodeEntities(m[2].replace(/<[^>]+>/g, '')).toUpperCase()
      const href = attr(m[1], 'href')
      if (href && label.includes('LICENSE')) {
        licenseHref = resolvePath(navDir, href)
        break
      }
    }
  } else if (![...manifest.values()].some((i) => i.type === NCX_TYPE)) {
    fail(
      `${file}: no table of contents (neither a nav document nor an NCX file)`,
    )
  }
  if (!licenseHref) {
    const endLine = stream.indexOf('*** END OF')
    const footer = /\0([^\0#]+#pg-footer-heading)\0/.exec(stream)
    if (footer) {
      licenseHref = footer[1]
    } else if (endLine >= 0) {
      // The file that holds the END line (the last file marker before it).
      const files = [...stream.slice(0, endLine).matchAll(/\0([^\0#]+)\0/g)]
      licenseHref = files[files.length - 1]?.[1]
    }
  }
  if (!licenseHref) fail(`${file}: Project Gutenberg licence section not found`)
  const licenseAt = locate({ stream }, licenseHref, file)

  return {
    file,
    title: dcField(opf, 'title'),
    author: dcField(opf, 'creator'),
    language: dcField(opf, 'language'),
    stream,
    licenseAt,
    licenseHref,
  }
}

/** Letters and digits only, lower case, so "The Monkey’s Paw" matches "THE MONKEY'S PAW". */
function titleKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Where a single work really begins: the first heading after the Project Gutenberg START line
 * whose text is the work's title. If no heading carries the title, the first heading with an id.
 * The EPUB is not changed; this only finds an existing anchor.
 */
export function findWorkStart(
  epub: Pick<Epub, 'stream' | 'licenseAt'>,
  title: string,
  file: string,
): string {
  const marker = /\*\*\* START OF [^\n]*?\*\*\*/.exec(epub.stream)
  if (!marker) fail(`${file}: no "*** START OF" line found`)
  const region = epub.stream.slice(
    marker.index + marker[0].length,
    epub.licenseAt,
  )
  const wanted = titleKey(title)
  const anchors = [...region.matchAll(/\0([^\0#]+#[^\0]+)\0/g)]
  if (anchors.length === 0)
    fail(`${file}: no heading with an id after the START line`)
  const heading = (m: RegExpMatchArray): string =>
    titleKey(
      stripMarkers(
        region.slice(
          (m.index ?? 0) + m[0].length,
          (m.index ?? 0) + m[0].length + 200,
        ),
      ),
    )
  const exact = anchors.find((m) => heading(m).startsWith(wanted))
  return (exact ?? anchors[0])[1]
}

/** Finds where an href (path#id) sits in the book text. */
export function locate(
  epub: Pick<Epub, 'stream'>,
  href: string,
  file: string,
): number {
  const at = epub.stream.indexOf(`\0${href}\0`)
  if (at >= 0) return at
  const fileOnly = href.split('#')[0]
  const fileAt = epub.stream.indexOf(`\0${fileOnly}\0`)
  if (href.includes('#') || fileAt < 0) {
    fail(`${file}: href not found in the EPUB: ${href}`)
  }
  return fileAt
}

const stripMarkers = (s: string): string => s.replace(/\0[^\0]*\0/g, '')

// ---------------------------------------------------------------- text helpers

const WORD = /[A-Za-z0-9À-￿]+(?:['’-][A-Za-z0-9À-￿]+)*/g

export function countWords(text: string): number {
  return (text.match(WORD) ?? []).length
}

export function lengthClassFor(minutes: number): LengthClass {
  if (minutes < 10) return 'under10'
  if (minutes < 30) return '10to30'
  if (minutes < 60) return '30to60'
  return '60plus'
}

/** A rough English syllable count. Good enough for a reading grade, and always the same answer. */
export function countSyllables(word: string): number {
  const parts = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .split('-')
  let total = 0
  for (const part of parts) {
    const w = part.replace(/[^a-z]/g, '')
    if (w === '') continue
    if (w.length <= 3) {
      total += 1
      continue
    }
    const stem = w
      .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
      .replace(/^y/, '')
    total += stem.match(/[aeiouy]{1,2}/g)?.length ?? 1
  }
  return Math.max(1, total)
}

/** Sentences end at . ! ? or an ellipsis. Abbreviations, initials and numbers like 1.87 do not end one. */
export function countSentences(text: string): number {
  const flat = text.replace(/\.(?:\s*\.)+/g, '\u2026')
  let count = 0
  for (const m of flat.matchAll(/[.!?\u2026]+/g)) {
    const at = m.index
    if (m[0] === '.') {
      const word =
        /([A-Za-z]+)$/.exec(flat.slice(Math.max(0, at - 12), at))?.[1] ?? ''
      if (ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word))
        continue
    }
    const next = flat[at + m[0].length]
    if (next !== undefined && /[a-z0-9]/.test(next)) continue
    count++
  }
  return Math.max(1, count)
}

export function readingBandFor(grade: number): ReadingBand {
  if (grade <= 6) return 'easy'
  if (grade <= 10) return 'medium'
  return 'challenging'
}

/** Flesch-Kincaid grade level: 0.39 x words per sentence + 11.8 x syllables per word - 15.59. */
export function readingLevelFor(text: string): ReadingLevel {
  const words = text.match(WORD) ?? []
  if (words.length === 0)
    fail('cannot work out a reading level: the text has no words')
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  const raw =
    0.39 * (words.length / countSentences(text)) +
    11.8 * (syllables / words.length) -
    15.59
  const grade = Math.max(0, Math.round(raw))
  return { grade, band: readingBandFor(grade) }
}

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'st',
  'mme',
  'mlle',
  'messrs',
  'prof',
  'capt',
  'col',
  'gen',
  'sr',
  'jr',
  'vs',
  'etc',
  'no',
  'nos',
])

/** The first sentence of a line, copied exactly (only the spacing is tidied). */
export function firstSentence(line: string): string {
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\u201c') inQuote = true
    else if (c === '\u201d') inQuote = false
    else if (c === '"') inQuote = !inQuote
    if (!'.!?\u2026'.includes(c)) continue
    let end = i + 1
    while (end < line.length && '\u201d\u2019"\')]'.includes(line[end])) end++
    // A closing quote right after the full stop ends the quotation too.
    const closesQuote = /[\u201d"]/.test(line.slice(i + 1, end))
    if (inQuote && !closesQuote) continue
    const rest = line.slice(end)
    if (rest !== '' && !/^\s+["'\u201c\u2018([]?[A-Z0-9]/.test(rest)) continue
    const word = /([A-Za-z]+)$/.exec(line.slice(0, i))?.[1] ?? ''
    if (
      c === '.' &&
      (ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word))
    )
      continue
    return line.slice(0, end).trim()
  }
  return line.trim()
}

/** The first real sentence of the story: skips headings, numbers, epigraphs and title pages. */
export function findFirstLine(text: string): string {
  const lines = text.split('\n')
  const tidy = (raw: string): string =>
    raw.split('\u0001').join('').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < lines.length; i++) {
    let line = tidy(lines[i])
    if (lines[i].startsWith('\u0001') || countWords(line) < 3) continue
    if (line === line.toUpperCase()) continue
    if (
      /^(produced|prepared|transcribed|illustrated|translated|edited) by\b|^credits\b/i.test(
        line,
      )
    )
      continue
    if (!/^["'“‘]?[A-Za-z]/.test(line)) continue
    if (!/[.!?…"'”’)—]$/.test(line)) continue
    // A sentence that breaks off with a dash carries on in the next paragraph.
    let sentence = firstSentence(line)
    for (
      let j = i + 1;
      sentence === line && /—$/.test(line) && j < lines.length;
      j++
    ) {
      line = `${line} ${tidy(lines[j])}`.trim()
      sentence = firstSentence(line)
    }
    return sentence
  }
  return ''
}

// ---------------------------------------------------------------- slug and cover

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const xml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line)
      line = word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function coverSvg(title: string, author: string): string {
  let hash = 2166136261
  for (const ch of title) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619)
  const hue = (hash >>> 0) % 360
  const titleLines = wrap(title, 16).slice(0, 6)
  const authorLines = wrap(author, 26).slice(0, 2)
  const titleText = titleLines
    .map(
      (l, i) =>
        `<text x="300" y="${260 + i * 70}" font-size="56" text-anchor="middle">${xml(l)}</text>`,
    )
    .join('')
  const authorText = authorLines
    .map(
      (l, i) =>
        `<text x="300" y="${780 + i * 40}" font-size="30" text-anchor="middle" opacity="0.9">${xml(l)}</text>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" role="img" aria-label="${xml(title)} by ${xml(author)}">` +
    `<rect width="600" height="900" fill="hsl(${hue} 45% 30%)"/>` +
    `<rect x="30" y="30" width="540" height="840" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="3"/>` +
    `<g fill="#fff" font-family="Georgia, 'Times New Roman', serif">${titleText}${authorText}</g>` +
    `</svg>\n`
  )
}

// ---------------------------------------------------------------- curation

export function eraBandFor(year: number): EraBand | undefined {
  if (year < 1800) return 'pre-1800'
  if (year < 1850) return '1800-1849'
  if (year < 1900) return '1850-1899'
  if (year <= 1930) return '1900-1930'
  return undefined
}

/** Fiction under 7,500 words is a story, 7,500 to 17,499 a novelette, 17,500 and over a novella. */
export function formForWordCount(words: number): Exclude<Form, 'essay'> {
  if (words < 7500) return 'story'
  if (words < 17500) return 'novelette'
  return 'novella'
}

export function loadCuration(): unknown {
  if (!existsSync(CURATION_JSON)) fail('content/curation.json not found')
  try {
    return JSON.parse(readFileSync(CURATION_JSON, 'utf8'))
  } catch (error) {
    fail(
      `content/curation.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickList<T extends string>(
  where: string,
  name: string,
  value: unknown,
  allowed: readonly T[],
  min: number,
  max: number,
): T[] {
  if (!Array.isArray(value)) fail(`${where}: ${name} must be a list`)
  if (value.length < min || value.length > max) {
    fail(
      `${where}: ${name} needs ${min === max ? min : `${min} to ${max}`} item${max === 1 ? '' : 's'}, found ${value.length}`,
    )
  }
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      !(allowed as readonly string[]).includes(item)
    ) {
      fail(`${where}: "${String(item)}" is not an allowed ${name} value`)
    }
  }
  if (new Set(value).size !== value.length)
    fail(`${where}: ${name} has a repeated value`)
  return value as T[]
}

function pickText(
  where: string,
  name: string,
  value: unknown,
  maxWords: number,
): string {
  if (typeof value !== 'string' || value.trim() === '')
    fail(`${where}: ${name} is missing`)
  const n = countWords(value)
  if (n > maxWords)
    fail(`${where}: ${name} has ${n} words, the limit is ${maxWords}`)
  return value
}

/**
 * Adds each entry's curation record. An entry with no record is left out (it is not ready to ship
 * yet). Stops if a record is invalid, or belongs to no catalog entry.
 */
export function mergeCuration(
  base: BaseEntry[],
  file: unknown,
): CatalogEntry[] {
  if (!isRecord(file) || !isRecord(file.entries)) {
    fail(
      'content/curation.json must look like { "schemaVersion": 1, "entries": { "<id>": { ... } } }',
    )
  }
  const records = file.entries
  const known = new Set(base.map((e) => e.id))
  for (const id of Object.keys(records)) {
    if (!known.has(id))
      fail(
        `content/curation.json has a record for ${id}, which is not a catalog entry`,
      )
  }
  return base.flatMap((entry): CatalogEntry[] => {
    const where = `content/curation.json, ${entry.id}`
    const r = records[entry.id]
    if (!isRecord(r)) return []

    const year = r.year
    if (typeof year !== 'number' || !Number.isInteger(year))
      fail(`${where}: year must be a whole number`)
    const eraBand = r.eraBand
    if (!(ERA_BANDS as readonly unknown[]).includes(eraBand))
      fail(`${where}: eraBand is missing or not allowed`)
    if (eraBandFor(year) !== eraBand)
      fail(`${where}: year ${year} is not in the era band ${String(eraBand)}`)

    const form = r.form
    if (!(FORMS as readonly unknown[]).includes(form))
      fail(`${where}: form is missing or not allowed`)
    if (form !== 'essay' && form !== formForWordCount(entry.wordCount)) {
      fail(
        `${where}: fiction of ${entry.wordCount} words is a ${formForWordCount(entry.wordCount)}, not a ${String(form)}`,
      )
    }

    if (typeof r.generatedBy !== 'string' || r.generatedBy === '')
      fail(`${where}: generatedBy is missing`)
    if (typeof r.reviewed !== 'boolean')
      fail(`${where}: reviewed must be true or false`)

    return [
      {
        ...entry,
        year,
        eraBand: eraBand as EraBand,
        form: form as Form,
        genres: pickList(where, 'genres', r.genres, GENRES, 1, 3),
        moods: pickList(where, 'moods', r.moods, MOODS, 1, 3),
        contentNotes: pickList(
          where,
          'contentNotes',
          r.contentNotes,
          CONTENT_NOTES,
          0,
          CONTENT_NOTES.length,
        ),
        hook: pickText(where, 'hook', r.hook, 20),
        blurb: pickText(where, 'blurb', r.blurb, 60),
        generatedBy: r.generatedBy,
        reviewed: r.reviewed,
      },
    ]
  })
}

// ---------------------------------------------------------------- build

const REQUIRED_CSV = ['file', 'story_title', 'source', 'source_url']

export function buildCatalog(): BuildResult {
  if (!existsSync(SOURCES_CSV)) fail('content/sources.csv not found')
  const rows = parseCsv(readFileSync(SOURCES_CSV, 'utf8'))
  if (rows.length === 0) fail('content/sources.csv has no rows')

  const epubCache = new Map<string, Epub>()
  const epubs = new Map<string, string>()
  const hashes = new Map<string, string>()
  const base: BaseEntry[] = []
  const rangeText: Record<string, string> = {}
  const ids = new Set<string>()

  rows.forEach((row, index) => {
    const where = `sources.csv row ${index + 2} (${row.file || '?'})`
    for (const col of REQUIRED_CSV) {
      if (!row[col]) fail(`${where}: missing ${col}`)
    }
    const number = /^pg-(\d+)-/.exec(row.file)?.[1]
    if (!number) fail(`${where}: file name must start with pg-<number>-`)
    const filePath = path.join(RAW_DIR, row.file)
    if (!existsSync(filePath)) fail(`${where}: file not found in content/raw/`)

    const sha256 = createHash('sha256')
      .update(readFileSync(filePath))
      .digest('hex')
    const known = hashes.get(number)
    if (known && known !== sha256)
      fail(
        `${where}: another EPUB with Gutenberg number ${number} has different content`,
      )
    hashes.set(number, sha256)
    if (!epubs.has(number)) epubs.set(number, row.file)

    let epub = epubCache.get(row.file)
    if (!epub) {
      epub = readEpub(row.file)
      epubCache.set(row.file, epub)
    }
    // The author of the story itself: the sources.csv story_author if given (anthologies often
    // have no author in their metadata), otherwise the EPUB's own author.
    const author = row.story_author || epub.author
    for (const [field, value] of [
      ['title', epub.title],
      ['author', author],
      ['language', epub.language],
    ]) {
      if (!value)
        fail(
          `${where}: EPUB metadata has no ${field}${field === 'author' ? ' (add story_author in sources.csv)' : ''}`,
        )
    }

    const csvStart = row.story_href || null
    const csvEnd = row.story_end_href || null
    if ((csvStart === null) !== (csvEnd === null)) {
      fail(
        `${where}: story_href and story_end_href must both be filled or both be blank`,
      )
    }
    const isCollection = csvStart !== null
    // A single work starts at its own title and ends where the licence section begins.
    const startHref = csvStart ?? findWorkStart(epub, row.story_title, where)
    const endHref = csvEnd ?? epub.licenseHref

    // Word counts and text still run from the START line (or the story) to the licence, as before.
    const from = csvStart ? locate(epub, csvStart, where) : 0
    const to = locate(epub, endHref, where)
    if (to <= from)
      fail(`${where}: the end of the story comes before its start`)
    // Cut Project Gutenberg's own header and footer, which sit inside the book files.
    let marked = stripMarkers(epub.stream.slice(from, to))
    const header = /\*\*\* START OF [^\n]*?\*\*\*/.exec(marked)
    if (header) marked = marked.slice(header.index + header[0].length)
    const footer = /\*\*\* END OF [^\n]*?\*\*\*/.exec(marked)
    if (footer) marked = marked.slice(0, footer.index)
    const tail = /\n\s*End of (?:the )?Project Gutenberg/i.exec(marked)
    if (tail) marked = marked.slice(0, tail.index)
    const notes = /\n\s*Transcriber['\u2019]s Notes?\s*\n/i.exec(marked)
    if (notes && notes.index > marked.length * 0.8)
      marked = marked.slice(0, notes.index)
    const text = marked.split('\u0001').join('')

    const id = `pg-${number}-${slugify(row.story_title)}`
    if (ids.has(id)) fail(`${where}: duplicate id ${id}`)
    ids.add(id)

    const words = countWords(text)
    const minutes = words / WORDS_PER_MINUTE
    const firstLine = findFirstLine(marked)
    if (!firstLine) fail(`${where}: could not find a first sentence`)
    rangeText[id] = text

    base.push({
      id,
      title: row.story_title,
      author,
      language: epub.language,
      bookTitle: epub.title,
      isCollection,
      wordCount: words,
      readingMinutes: Math.max(1, Math.round(minutes)),
      lengthClass: lengthClassFor(minutes),
      readingLevel: readingLevelFor(text),
      firstLine,
      textUrl: `/texts/pg-${number}.epub`,
      coverUrl: `/covers/${id}.svg`,
      startHref,
      endHref,
      sha256,
      source: row.source,
      sourceUrl: row.source_url,
      license: LICENSE,
    })
  })

  const used = new Set(rows.map((r) => r.file))
  for (const f of readdirSync(RAW_DIR)) {
    if (f.endsWith('.epub') && !used.has(f))
      console.warn(`catalog: ${f} is in content/raw/ but not in sources.csv`)
  }
  const entries = mergeCuration(base, loadCuration()).filter((e) => e.reviewed)
  const shipped = new Set(entries.map((e) => e.id))
  const skipped = base.filter((e) => !shipped.has(e.id))
  // Only the books of entries that ship are published.
  const shippedNumbers = new Set(
    entries.map((e) => /^\/texts\/pg-(\d+)\.epub$/.exec(e.textUrl)?.[1] ?? ''),
  )
  const shippedEpubs = new Map(
    [...epubs].filter(([number]) => shippedNumbers.has(number)),
  )
  return { entries, base, skipped, rangeText, epubs: shippedEpubs }
}

function writeOutputs({ entries, epubs }: BuildResult): void {
  for (const dir of [OUT_CATALOG, OUT_TEXTS, OUT_COVERS]) {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }
  for (const [number, file] of epubs) {
    copyFileSync(
      path.join(RAW_DIR, file),
      path.join(OUT_TEXTS, `pg-${number}.epub`),
    )
  }
  for (const e of entries) {
    writeFileSync(
      path.join(OUT_COVERS, `${e.id}.svg`),
      coverSvg(e.title, e.author),
    )
  }
  writeFileSync(
    path.join(OUT_CATALOG, 'catalog.json'),
    JSON.stringify({ schemaVersion: 1, entries }, null, 2) + '\n',
  )
}

function main(): void {
  try {
    const result = buildCatalog()
    writeOutputs(result)
    const held = result.skipped.length
    console.log(
      `catalog: ${result.entries.length} entries from ${result.epubs.size} EPUBs -> public/catalog/catalog.json` +
        (held > 0
          ? ` (${held} more in sources.csv are not shipped yet: no reviewed curation record)`
          : ''),
    )
  } catch (error) {
    console.error(
      `catalog: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
