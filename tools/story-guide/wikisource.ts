// Story Guide: Wikisource, through the MediaWiki API on en.wikisource.org only. Server-side, one
// request at a time, with a descriptive User-Agent that includes the repo URL (Wikimedia's
// policy). Only what the API returns is used; no rendered pages are scraped. Public domain only:
// a page is analysed only when its licence tags or categories mark it public domain in the US.
// A build-time tool: it never ships in the app.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import {
  MAX_ANALYSED_WORDS,
  SourceError,
  USER_AGENT,
  countWords,
  type Fetch,
  type SearchResult,
} from './common.ts'

export class WikisourceError extends SourceError {}
/** The page is not marked US public domain, so it is not fetched or analysed. */
export class NotPublicDomain extends WikisourceError {}

const API = 'https://en.wikisource.org/w/api.php'
export const NOT_PD_NOTE = 'Not marked US public domain'

export const wikisourcePage = (title: string): string =>
  `https://en.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`

const DOWN =
  'Wikisource is not answering right now. Try again in a minute, or use Project Gutenberg or pasted text instead.'

export interface WikisourceOptions {
  fetchFn?: Fetch
  cacheDir?: URL
  /** A short pause after each request, to be gentle on the servers. */
  pauseMs?: number
}

const CACHE = new URL('./cache/', import.meta.url)
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// One request at a time: each waits for the one before it to finish.
let chain: Promise<void> = Promise.resolve()
function oneAtATime<T>(task: () => Promise<T>, pauseMs: number): Promise<T> {
  const run = chain.then(task)
  chain = run.then(
    () => sleep(pauseMs),
    () => sleep(pauseMs),
  )
  return run
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function api(
  params: Record<string, string>,
  options: WikisourceOptions,
): Promise<Json> {
  const fetchFn = options.fetchFn ?? fetch
  const url = `${API}?${new URLSearchParams({
    ...params,
    format: 'json',
    formatversion: '2',
    // Ask the servers to refuse us when they are lagging behind, rather than add to the load.
    maxlag: '5',
  })}`
  return oneAtATime(async () => {
    let response: Response
    try {
      response = await fetchFn(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      })
    } catch {
      throw new WikisourceError(DOWN)
    }
    if (!response.ok) throw new WikisourceError(DOWN)
    let body: Json
    try {
      body = (await response.json()) as Json
    } catch {
      throw new WikisourceError(DOWN)
    }
    if (body.error) {
      if (body.error.code === 'maxlag')
        throw new WikisourceError(
          'Wikisource is busy right now. Try again in a minute.',
        )
      throw new WikisourceError(
        `Wikisource said: ${String(body.error.info ?? body.error.code)}`,
      )
    }
    return body
  }, options.pauseMs ?? 200)
}

// ------------------------------------------------------------------ search

export interface WikisourceHit {
  title: string
  /** The words in the page's indexed text, which the API reports. */
  words: number
}

/** A subpage that is only a chapter or part of a bigger work, not a work of its own. */
const CHAPTER_LIKE =
  /^(?:chapter|part|book|section|canto|act|scene|volume|vol\.?|page|index|contents|preface|introduction|appendix|epilogue|prologue|\d+)\b|^[ivxlcdm]+\.?$/i

/** The top-level works that match a search, in the order Wikisource ranks them. */
export async function searchWikisource(
  query: string,
  limit: number,
  options: WikisourceOptions = {},
): Promise<WikisourceHit[]> {
  const body = await api(
    {
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '0',
      srlimit: '50',
      srprop: 'wordcount',
    },
    options,
  )
  const seen = new Set<string>()
  const hits: WikisourceHit[] = []
  for (const r of (body.query?.search ?? []) as {
    title: string
    wordcount?: number
  }[]) {
    const segments = r.title.split('/')
    // "Collection/Story" is a work of its own; "Novel/Chapter 3" is only a piece of one.
    if (segments.length > 1 && CHAPTER_LIKE.test(segments[segments.length - 1]))
      continue
    if (seen.has(r.title)) continue
    seen.add(r.title)
    hits.push({ title: r.title, words: r.wordcount ?? 0 })
  }
  return hits.slice(0, limit)
}

// -------------------------------------------------------------- page details

export interface PageInfo {
  /** The title after redirects. */
  title: string
  /** An editions page (versions or disambiguation) lists works instead of holding a text. */
  kind: 'work' | 'editions'
  author: string
  /** The licence tag that marks the page public domain in the US, or null. */
  license: { tag: string; from?: string } | null
  missing: boolean
}

const TAG_TEMPLATES = [
  'Template:PD-US',
  'Template:PD/US',
  'Template:PD-old',
  'Template:PD-old-70',
  'Template:PD-old-100',
  'Template:PD-US-1923-abroad',
  'Template:PD-US-expired',
  'Template:PD-1923',
  'Template:PD-USGov',
  'Template:PD-US-no-notice',
  'Template:PD-US-not-renewed',
  'Template:Disambiguation',
  'Template:Versions',
]
const PD_TAG = /^PD[-/](?:US|old|1923|USGov|expired|1996)/i

/** The licence tag in a page's templates or categories that marks it US public domain. */
export function licenceTag(
  templates: string[],
  categories: string[],
): string | null {
  for (const t of templates) {
    const name = t.replace(/^Template:/, '')
    if (PD_TAG.test(name)) return name
  }
  for (const c of categories) {
    const name = c.replace(/^Category:/, '')
    if (PD_TAG.test(name)) return name
  }
  return null
}

/** The author named in a work's header template, from the wikitext of the page's first section. */
export function authorFromHeader(wikitext: string): string {
  // Up to the next template parameter or the end of the template; a [[link|label]] may hold a pipe.
  const raw =
    /\|\s*author\s*=\s*((?:\[\[[^\]]*\]\]|\{\{[^}]*\}\}|[^\n|}])*)/i.exec(
      wikitext,
    )?.[1] ?? ''
  const name = raw
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/^Author:/i, '')
    .replace(/<[^>]*>/g, '')
    .trim()
  return name || 'Unknown author'
}

const chunk = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  )

/**
 * Details for pages: their author, licence tag and kind. Titles are asked about in groups, one
 * request at a time. A page with no licence tag of its own (a story inside a collection, say)
 * takes its parent page's tag.
 */
export async function describePages(
  titles: string[],
  options: WikisourceOptions = {},
  depth = 0,
): Promise<Map<string, PageInfo>> {
  const out = new Map<string, PageInfo>()
  for (const group of chunk([...new Set(titles)], 20)) {
    const pages = new Map<
      string,
      {
        templates: string[]
        categories: string[]
        content: string
        missing: boolean
      }
    >()
    let more: Record<string, string> = {}
    const renamed = new Map<string, string>()
    for (let round = 0; round < 6; round++) {
      const body = await api(
        {
          action: 'query',
          titles: group.join('|'),
          redirects: '1',
          prop: 'templates|categories|revisions',
          tltemplates: TAG_TEMPLATES.join('|'),
          tllimit: 'max',
          cllimit: 'max',
          rvprop: 'content',
          rvslots: 'main',
          rvsection: '0',
          ...more,
        },
        options,
      )
      for (const m of [
        ...(body.query?.normalized ?? []),
        ...(body.query?.redirects ?? []),
      ] as { from: string; to: string }[])
        renamed.set(m.from, m.to)
      for (const p of (body.query?.pages ?? []) as Json[]) {
        const page = pages.get(p.title) ?? {
          templates: [],
          categories: [],
          content: '',
          missing: false,
        }
        page.missing = page.missing || Boolean(p.missing)
        page.templates.push(...(p.templates ?? []).map((t: Json) => t.title))
        page.categories.push(...(p.categories ?? []).map((c: Json) => c.title))
        page.content ||= p.revisions?.[0]?.slots?.main?.content ?? ''
        pages.set(p.title, page)
      }
      if (!body.continue) break
      more = body.continue as Record<string, string>
    }
    for (const requested of group) {
      let title = requested
      for (let i = 0; i < 3 && renamed.has(title); i++)
        title = renamed.get(title) as string
      const page = pages.get(title)
      const templates = page?.templates ?? []
      const categories = page?.categories ?? []
      const editions =
        templates.includes('Template:Disambiguation') ||
        templates.includes('Template:Versions') ||
        categories.some((c) => /disambiguation|versions pages?/i.test(c))
      const tag = licenceTag(templates, categories)
      out.set(requested, {
        title,
        kind: editions ? 'editions' : 'work',
        author: authorFromHeader(page?.content ?? ''),
        license: tag ? { tag } : null,
        missing: page === undefined || page.missing,
      })
    }
  }

  // A page with no licence tag of its own is covered by the work it belongs to.
  const orphans = [...out.values()].filter(
    (info) => !info.license && !info.missing && info.title.includes('/'),
  )
  if (orphans.length > 0 && depth < 3) {
    const parentOf = (title: string) => title.slice(0, title.lastIndexOf('/'))
    const parents = await describePages(
      orphans.map((o) => parentOf(o.title)),
      options,
      depth + 1,
    )
    for (const info of orphans) {
      const parent = parents.get(parentOf(info.title))
      if (parent?.license)
        info.license = {
          tag: parent.license.tag,
          from: parent.license.from ?? parent.title,
        }
    }
  }
  return out
}

// ------------------------------------------------------------------ cleaning

const REMOVE = [
  'style',
  'script',
  '.ws-noexport', // headers, navigation, page-number boxes and the like
  '.noprint',
  '.navbox',
  '.pagenum',
  '.mw-editsection',
  'sup.reference',
  '.reference', // footnote markers
  '.references',
  '.mw-references-wrap',
  '.printfooter',
  '.catlinks',
  '.searchaux',
  '.toc',
  '#toc',
  '.wst-header',
  '.ws-header',
  '[role="navigation"]',
  '.error',
  '[class*="license" i]', // the copyright licence banner at the end of a page
  '[id*="license" i]',
  '[style*="display:none"]', // hidden helper text such as "Layout 2"
  '[style*="display: none"]',
  '[hidden]',
  '.plainSister',
  '.sisterproject',
  '[class*="editor-note"]',
  '[class*="editornote"]',
  '[class*="transcriber"]',
]

/**
 * The plain text of a page the API rendered, without headers, navigation, page numbers,
 * footnote markers and editor notes; and the subpages it links to, in the order it lists them.
 */
export function cleanWikisourceHtml(
  html: string,
  title: string,
): { text: string; subpages: string[] } {
  const doc = new JSDOM(html).window.document
  for (const selector of REMOVE)
    for (const el of doc.querySelectorAll(selector)) el.remove()

  const subpages: string[] = []
  for (const a of doc.querySelectorAll('a[title]')) {
    const target = a.getAttribute('title') ?? ''
    if (
      target.startsWith(`${title}/`) &&
      !a.classList.contains('new') &&
      !subpages.includes(target)
    )
      subpages.push(target)
  }

  for (const br of doc.querySelectorAll('br')) br.replaceWith('\n')
  for (const el of doc.querySelectorAll(
    'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,tr,dt,dd,pre,table,ul,ol',
  ))
    el.append('\n\n')
  const text = (doc.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\[(?:editor|transcriber)['’]?s? notes?[^\]]*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, subpages }
}

// ------------------------------------------------------------------- fetching

/** At most this many pages are fetched for one work. */
const MAX_PAGES = 120

async function parsePage(
  title: string,
  options: WikisourceOptions,
): Promise<{ title: string; html: string }> {
  const body = await api(
    {
      action: 'parse',
      page: title,
      prop: 'text',
      redirects: '1',
      disableeditsection: '1',
      disablelimitreport: '1',
    },
    options,
  )
  const parsed = body.parse as { title?: string; text?: string } | undefined
  if (!parsed?.text)
    throw new WikisourceError(`Wikisource sent no text for "${title}".`)
  return { title: parsed.title ?? title, html: parsed.text }
}

/**
 * The text of a work. A work split into chapter subpages is fetched subpage by subpage, in the
 * order its page lists them, and joined; fetching stops at 20,000 words (`partial` says more was
 * left).
 */
export async function fetchWorkText(
  title: string,
  options: WikisourceOptions = {},
): Promise<{ text: string; partial: boolean }> {
  const state = { words: 0, pages: 0, partial: false }
  const pieces: string[] = []

  async function gather(page: string, depth: number): Promise<void> {
    state.pages++
    const { title: resolved, html } = await parsePage(page, options)
    const { text, subpages } = cleanWikisourceHtml(html, resolved)
    const words = countWords(text)
    // A short page that links to several subpages is a table of contents: read what it links to.
    const contents = subpages.length >= 2 && words < 600 && depth < 3
    if (text) {
      pieces.push(text)
      state.words += words
    }
    if (!contents) return
    for (const sub of subpages) {
      if (state.words >= MAX_ANALYSED_WORDS || state.pages >= MAX_PAGES) {
        state.partial = true
        return
      }
      await gather(sub, depth + 1)
    }
  }
  await gather(title, 0)
  return { text: pieces.join('\n\n'), partial: state.partial }
}

// ------------------------------------------------------------- editions pages

const OTHER_NAMESPACES =
  /^(?:Author|Category|Portal|Wikisource|File|Image|Help|Index|Page|Template|Special|Talk|Wikipedia|Wikidata|w|s|commons|d):/i

/** The works an editions page (versions or disambiguation) lists, with each one's description. */
export function parseEditionLinks(
  wikitext: string,
): { title: string; note: string }[] {
  const out: { title: string; note: string }[] = []
  for (const line of wikitext.split('\n')) {
    if (!/^[*#]/.test(line)) continue
    const link = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/.exec(line)
    if (!link) continue
    const title = link[1].replace(/_/g, ' ').replace(/^:/, '').trim()
    if (OTHER_NAMESPACES.test(title) || out.some((o) => o.title === title))
      continue
    const note = line
      .slice(link.index + link[0].length)
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/'{2,}/g, '')
      .replace(/^[\s,.:;–—-]+/, '')
      .trim()
    out.push({ title, note })
  }
  return out
}

// ---------------------------------------------------------------------- picking

export interface WikisourceText {
  kind: 'text'
  title: string
  author: string
  license: { tag: string; from?: string }
  url: string
  /** The cleaned text of the work (all of what was fetched). */
  text: string
  /** More of the work exists than was fetched (fetching stops at 20,000 words). */
  partial: boolean
}

export interface WikisourceEditions {
  kind: 'editions'
  title: string
  choices: SearchResult[]
}

const safeName = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** How a Wikisource page is shown as a result. */
export function wikisourceResult(
  title: string,
  info: PageInfo | undefined,
  words?: number,
): SearchResult {
  const parts = title.split('/')
  const display =
    parts.length > 1
      ? `${parts[parts.length - 1]} (in ${parts.slice(0, -1).join('/')})`
      : title
  const editions = info?.kind === 'editions'
  return {
    source: 'wikisource',
    key: title,
    title: display,
    author: editions ? 'Several editions' : (info?.author ?? 'Unknown author'),
    words: editions ? undefined : words,
    license: info?.license?.tag ?? null,
    kind: editions ? 'editions' : 'work',
    ...(!editions && !info?.license ? { note: NOT_PD_NOTE } : {}),
  }
}

/**
 * Picks a Wikisource page. An editions page returns its editions as choices; a page not marked
 * US public domain is refused; anything else is fetched (or read from the cache) as text.
 */
export async function pickWikisource(
  title: string,
  options: WikisourceOptions = {},
): Promise<WikisourceText | WikisourceEditions> {
  const cacheDir = options.cacheDir ?? CACHE
  const base = `ws-${safeName(title)}`
  try {
    const meta = JSON.parse(
      await readFile(new URL(`${base}.json`, cacheDir), 'utf8'),
    ) as Omit<WikisourceText, 'kind' | 'text'>
    const text = await readFile(new URL(`${base}.txt`, cacheDir), 'utf8')
    return { kind: 'text', ...meta, text }
  } catch {
    // Not cached yet.
  }

  const info = (await describePages([title], options)).get(title)
  if (!info || info.missing)
    throw new WikisourceError(`There is no Wikisource page called "${title}".`)

  if (info.kind === 'editions') {
    const body = await api(
      {
        action: 'query',
        titles: info.title,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
      },
      options,
    )
    const wikitext: string =
      body.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? ''
    const links = parseEditionLinks(wikitext).slice(0, 30)
    const details = await describePages(
      links.map((l) => l.title),
      options,
    )
    return {
      kind: 'editions',
      title: info.title,
      choices: links
        .filter((l) => !details.get(l.title)?.missing)
        .map((l) => {
          const result = wikisourceResult(l.title, details.get(l.title))
          return l.note ? { ...result, note: result.note ?? l.note } : result
        }),
    }
  }

  if (!info.license)
    throw new NotPublicDomain(
      `"${info.title}" is ${NOT_PD_NOTE.toLowerCase()}, so it is not analysed.`,
    )

  const { text, partial } = await fetchWorkText(info.title, options)
  const meta = {
    title: info.title,
    author: info.author,
    license: info.license,
    url: wikisourcePage(info.title),
    partial,
  }
  await mkdir(cacheDir, { recursive: true })
  await writeFile(new URL(`${base}.txt`, cacheDir), text, 'utf8')
  await writeFile(
    new URL(`${base}.json`, cacheDir),
    JSON.stringify(meta),
    'utf8',
  )
  return { kind: 'text', ...meta, text }
}
