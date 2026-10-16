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
const OUT_CATALOG = path.join(ROOT, 'public', 'catalog')
const OUT_TEXTS = path.join(ROOT, 'public', 'texts')
const OUT_COVERS = path.join(ROOT, 'public', 'covers')

const WORDS_PER_MINUTE = 230
const LICENSE = 'Project Gutenberg License'

export type LengthClass = 'under10' | '10to30' | '30to60' | '60plus'

export interface CatalogEntry {
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
  firstLine: string
  textUrl: string
  coverUrl: string
  /** Where the story starts inside the EPUB. Null for single works. */
  startHref: string | null
  /** Where the next story starts, so the reader knows where this one ends. Null for single works. */
  endHref: string | null
  sha256: string
  source: string
  sourceUrl: string
  license: string
}

export interface BuildResult {
  entries: CatalogEntry[]
  /** The text range of each entry (by id), for tests. */
  rangeText: Record<string, string>
  /** Unique EPUBs to publish: Gutenberg number -> source file. */
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
    last = m.index + m[0].length
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

  const manifest = new Map<string, { href: string; props: string }>()
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = attr(m[0], 'id')
    const href = attr(m[0], 'href')
    if (id && href)
      manifest.set(id, {
        href: resolvePath(base, href),
        props: attr(m[0], 'properties') ?? '',
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

  // The licence section starts at the table-of-contents entry labelled "...LICENSE".
  const nav = [...manifest.values()].find((i) =>
    i.props.split(/\s+/).includes('nav'),
  )
  if (!nav) fail(`${file}: no navigation document (table of contents)`)
  const navDir = path.posix.dirname(nav.href)
  let licenseHref: string | undefined
  for (const m of read(nav.href).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, '')).toUpperCase()
    const href = attr(m[1], 'href')
    if (href && label.includes('LICENSE')) {
      licenseHref = resolvePath(navDir, href)
      break
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
  }
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

// ---------------------------------------------------------------- build

const REQUIRED_CSV = ['file', 'story_title', 'source', 'source_url']

export function buildCatalog(): BuildResult {
  if (!existsSync(SOURCES_CSV)) fail('content/sources.csv not found')
  const rows = parseCsv(readFileSync(SOURCES_CSV, 'utf8'))
  if (rows.length === 0) fail('content/sources.csv has no rows')

  const epubCache = new Map<string, Epub>()
  const epubs = new Map<string, string>()
  const hashes = new Map<string, string>()
  const entries: CatalogEntry[] = []
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
    for (const [field, value] of [
      ['title', epub.title],
      ['author', epub.author],
      ['language', epub.language],
    ]) {
      if (!value) fail(`${where}: EPUB metadata has no ${field}`)
    }

    const startHref = row.story_href || null
    const endHref = row.story_end_href || null
    if ((startHref === null) !== (endHref === null)) {
      fail(
        `${where}: story_href and story_end_href must both be filled or both be blank`,
      )
    }
    const isCollection = startHref !== null

    const from = startHref ? locate(epub, startHref, where) : 0
    const to = endHref ? locate(epub, endHref, where) : epub.licenseAt
    if (to <= from)
      fail(`${where}: the end of the story comes before its start`)
    // Cut Project Gutenberg's own header and footer, which sit inside the book files.
    let marked = stripMarkers(epub.stream.slice(from, to))
    const header = /\*\*\* START OF [^\n]*?\*\*\*/.exec(marked)
    if (header) marked = marked.slice(header.index + header[0].length)
    const footer = /\*\*\* END OF [^\n]*?\*\*\*/.exec(marked)
    if (footer) marked = marked.slice(0, footer.index)
    const text = marked.split('\u0001').join('')

    const id = `pg-${number}-${slugify(row.story_title)}`
    if (ids.has(id)) fail(`${where}: duplicate id ${id}`)
    ids.add(id)

    const words = countWords(text)
    const minutes = words / WORDS_PER_MINUTE
    const firstLine = findFirstLine(marked)
    if (!firstLine) fail(`${where}: could not find a first sentence`)
    rangeText[id] = text

    entries.push({
      id,
      title: row.story_title,
      author: epub.author,
      language: epub.language,
      bookTitle: epub.title,
      isCollection,
      wordCount: words,
      readingMinutes: Math.max(1, Math.round(minutes)),
      lengthClass: lengthClassFor(minutes),
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
  return { entries, rangeText, epubs }
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
    console.log(
      `catalog: ${result.entries.length} entries from ${result.epubs.size} EPUBs -> public/catalog/catalog.json`,
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
