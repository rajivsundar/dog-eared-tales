import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { USER_AGENT } from './common.ts'
import {
  NotPublicDomain,
  WikisourceError,
  authorFromHeader,
  cleanWikisourceHtml,
  describePages,
  fetchWorkText,
  licenceTag,
  parseEditionLinks,
  pickWikisource,
  searchWikisource,
} from './wikisource.ts'

interface FakePage {
  templates?: string[]
  categories?: string[]
  /** Wikitext of the first section, where the header template names the author. */
  content?: string
  html?: string
  missing?: boolean
}

/** A pretend en.wikisource.org API: it records every request and how many ran at once. */
function fakeWikisource(
  pages: Record<string, FakePage>,
  searchResults: { title: string; wordcount?: number }[] = [],
) {
  const calls: { params: URLSearchParams; headers: Record<string, string> }[] =
    []
  let inFlight = 0
  let maxInFlight = 0
  const fetchFn = (async (url: string, init: RequestInit) => {
    const params = new URL(url).searchParams
    calls.push({ params, headers: init.headers as Record<string, string> })
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 2))
    inFlight--
    const json = (body: unknown) => new Response(JSON.stringify(body))
    if (params.get('list') === 'search')
      return json({ query: { search: searchResults } })
    if (params.get('action') === 'parse') {
      const title = params.get('page') as string
      const page = pages[title]
      if (!page?.html)
        return json({ error: { code: 'missingtitle', info: 'no such page' } })
      return json({ parse: { title, text: page.html } })
    }
    const titles = (params.get('titles') as string).split('|')
    return json({
      query: {
        pages: titles.map((title) => {
          const page = pages[title]
          return page
            ? {
                title,
                templates: (page.templates ?? []).map((t) => ({ title: t })),
                categories: (page.categories ?? []).map((c) => ({ title: c })),
                revisions: [
                  { slots: { main: { content: page.content ?? '' } } },
                ],
              }
            : { title, missing: true }
        }),
      },
    })
  }) as unknown as typeof fetch
  return { fetchFn, calls, maxInFlight: () => maxInFlight }
}

const words = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ')
const page = (body: string, extra = '') =>
  `<div class="mw-parser-output"><div class="ws-noexport"><style>.x{}</style><div class="wst-header">HEADER Saki Prev Next <a href="/wiki/Work/Prev" title="Work/Prev">prev</a></div></div>${extra}${body}</div>`

describe('how Wikisource is asked', () => {
  it('sends a descriptive User-Agent with the repo URL, and one request at a time', async () => {
    const wiki = fakeWikisource({ A: { content: '' }, B: { content: '' } }, [
      { title: 'A', wordcount: 10 },
    ])
    await Promise.all([
      searchWikisource('a', 10, { fetchFn: wiki.fetchFn, pauseMs: 0 }),
      describePages(['A'], { fetchFn: wiki.fetchFn, pauseMs: 0 }),
      describePages(['B'], { fetchFn: wiki.fetchFn, pauseMs: 0 }),
    ])
    expect(wiki.calls).toHaveLength(3)
    expect(wiki.maxInFlight()).toBe(1)
    for (const call of wiki.calls) {
      expect(call.headers['User-Agent']).toBe(USER_AGENT)
      expect(call.headers['User-Agent']).toContain(
        'https://github.com/rajivsundar/dog-eared-tales',
      )
      expect(call.params.get('maxlag')).toBe('5')
    }
  })

  it('says clearly when Wikisource is not answering', async () => {
    const down = (async () =>
      new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(
      searchWikisource('a', 10, { fetchFn: down, pauseMs: 0 }),
    ).rejects.toThrow(/Wikisource is not answering right now/)
    const gone = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(
      describePages(['A'], { fetchFn: gone, pauseMs: 0 }),
    ).rejects.toBeInstanceOf(WikisourceError)
  })
})

describe('searchWikisource', () => {
  it('keeps works and stories in collections, drops chapter pages and repeats, and reads the word count', async () => {
    const wiki = fakeWikisource({}, [
      { title: 'Beasts and Super-Beasts/The Open Window', wordcount: 1236 },
      { title: 'The Luck of the Irish/Chapter 21', wordcount: 2643 },
      { title: 'Novel/IV', wordcount: 900 },
      { title: 'Novel/Part Two', wordcount: 900 },
      { title: 'Frankenstein', wordcount: 75000 },
      { title: 'Frankenstein', wordcount: 75000 },
    ])
    const hits = await searchWikisource('x', 10, {
      fetchFn: wiki.fetchFn,
      pauseMs: 0,
    })
    expect(hits).toEqual([
      { title: 'Beasts and Super-Beasts/The Open Window', words: 1236 },
      { title: 'Frankenstein', words: 75000 },
    ])
    expect(wiki.calls[0].params.get('srnamespace')).toBe('0')
  })
})

describe('public-domain tags', () => {
  it('accepts US public-domain licence templates and categories only', () => {
    expect(licenceTag(['Template:Header', 'Template:PD-US'], [])).toBe('PD-US')
    expect(licenceTag([], ['Category:Fiction', 'Category:PD-old'])).toBe(
      'PD-old',
    )
    expect(licenceTag(['Template:Header'], ['Category:Fiction'])).toBeNull()
    expect(licenceTag(['Template:CC-BY-SA'], [])).toBeNull()
  })

  it('reads the author from the header template', () => {
    expect(
      authorFromHeader(
        '{{header\n | title = X\n | author   = Saki\n | year = 1914\n}}',
      ),
    ).toBe('Saki')
    expect(
      authorFromHeader(
        '{{header|author=[[Author:Edgar Allan Poe|Edgar Allan Poe]]|title=Y}}',
      ),
    ).toBe('Edgar Allan Poe')
    expect(authorFromHeader('no header')).toBe('Unknown author')
  })
})

describe('describePages', () => {
  const wiki = () =>
    fakeWikisource({
      Tale: {
        templates: ['Template:PD-US'],
        content: '{{header|author=Saki}}',
      },
      'Modern Tale': {
        templates: [],
        categories: ['Category:Fiction'],
        content: '{{header|author=Somebody}}',
      },
      'The Open Window': {
        templates: ['Template:Disambiguation'],
        content: '{{disambiguation}}',
      },
      Collection: {
        templates: ['Template:PD-US'],
        content: '{{header|author=Saki}}',
      },
      'Collection/Story': { content: '{{header|author=Saki}}' },
    })

  it('says who wrote a page and what its licence tag is; no tag means not public domain', async () => {
    const info = await describePages(['Tale', 'Modern Tale'], {
      fetchFn: wiki().fetchFn,
      pauseMs: 0,
    })
    expect(info.get('Tale')).toMatchObject({
      kind: 'work',
      author: 'Saki',
      license: { tag: 'PD-US' },
    })
    expect(info.get('Modern Tale')?.license).toBeNull()
  })

  it('recognises a versions or disambiguation page', async () => {
    const info = await describePages(['The Open Window'], {
      fetchFn: wiki().fetchFn,
      pauseMs: 0,
    })
    expect(info.get('The Open Window')?.kind).toBe('editions')
  })

  it("lets a story inside a collection take the collection's tag", async () => {
    const info = await describePages(['Collection/Story'], {
      fetchFn: wiki().fetchFn,
      pauseMs: 0,
    })
    expect(info.get('Collection/Story')?.license).toEqual({
      tag: 'PD-US',
      from: 'Collection',
    })
  })
})

describe('cleanWikisourceHtml', () => {
  it('drops headers, navigation, page numbers, footnote markers and editor notes, and keeps the story', () => {
    const html = page(
      `<div class="navbox">NAVBOX</div>
       <p>It was a dark night.<sup class="reference"><a href="#n1">[1]</a></sup> The wind blew.</p>
       <span class="pagenum ws-pagenum">12</span>
       <p>Second paragraph<br>with a line break.</p>
       <p>[Editor's note: spelling modernised.]</p>
       <ol class="references"><li>FOOTNOTE TEXT</li></ol>`,
    )
    const { text } = cleanWikisourceHtml(html, 'Work')
    expect(text).toBe(
      'It was a dark night. The wind blew.\n\nSecond paragraph\nwith a line break.',
    )
    for (const gone of ['HEADER', 'NAVBOX', '[1]', 'FOOTNOTE', '12', 'Editor'])
      expect(text).not.toContain(gone)
  })

  it('drops the licence banner and hidden helper text that real pages carry', () => {
    const html = page(
      `<p><br /><span style="display:none" id="dynamic_layout_overrider">Layout 2</span></p>
       <p>The bungalow stood in some twenty acres.</p>
       <div class="licenseContainer licenseBanner"><p>This work is in the public domain in the United States because it was published before 1930.</p></div>
       <div class="licensetpl"><p><span class="licensetpl_short">Public domain</span></p></div>`,
    )
    const { text } = cleanWikisourceHtml(html, 'Work')
    expect(text).toBe('The bungalow stood in some twenty acres.')
  })

  it('lists subpages in the order the page lists them, not the header links or missing pages', () => {
    const html = page(
      `<ul>
        <li><a href="/wiki/Work/Chapter_10" title="Work/Chapter 10">10</a></li>
        <li><a href="/wiki/Work/Chapter_2" title="Work/Chapter 2">2</a></li>
        <li><a class="new" href="/w/index.php?title=Work/Chapter_3" title="Work/Chapter 3">3</a></li>
        <li><a href="/wiki/Other/Chapter_1" title="Other/Chapter 1">x</a></li>
       </ul>`,
    )
    expect(cleanWikisourceHtml(html, 'Work').subpages).toEqual([
      'Work/Chapter 10',
      'Work/Chapter 2',
    ])
  })
})

describe('fetchWorkText', () => {
  const toc = (links: string[]) =>
    page(
      `<p>Contents</p><ul>${links.map((t) => `<li><a href="/wiki/x" title="${t}">${t}</a></li>`).join('')}</ul>`,
    )

  it('joins chapter subpages in the order listed', async () => {
    const wiki = fakeWikisource({
      Novel: {
        html: toc(['Novel/Chapter 10', 'Novel/Chapter 2']),
      },
      'Novel/Chapter 10': { html: page('<p>ten ten</p>') },
      'Novel/Chapter 2': { html: page('<p>two two</p>') },
    })
    const result = await fetchWorkText('Novel', {
      fetchFn: wiki.fetchFn,
      pauseMs: 0,
    })
    expect(result.text).toBe(
      'Contents\n\nNovel/Chapter 10\n\nNovel/Chapter 2\n\nten ten\n\ntwo two',
    )
    expect(result.partial).toBe(false)
  })

  it('stops at 20,000 words and says there was more', async () => {
    const chapters = ['A', 'B', 'C', 'D'].map((c) => `Big/${c}`)
    const wiki = fakeWikisource({
      Big: { html: toc(chapters) },
      ...Object.fromEntries(
        chapters.map((c) => [
          c,
          { html: page(`<p>${words(9000, c.slice(-1))}</p>`) },
        ]),
      ),
    })
    const result = await fetchWorkText('Big', {
      fetchFn: wiki.fetchFn,
      pauseMs: 0,
    })
    // Contents + 3 chapters (9,000 each) reach 27,000 words; the fourth is not fetched.
    expect(result.partial).toBe(true)
    expect(result.text).not.toContain('D0')
    expect(
      wiki.calls.filter((c) => c.params.get('action') === 'parse'),
    ).toHaveLength(4)
  })

  it('reads a single page as it is', async () => {
    const wiki = fakeWikisource({
      Poem: { html: page('<p>Once upon a midnight dreary.</p>') },
    })
    const result = await fetchWorkText('Poem', {
      fetchFn: wiki.fetchFn,
      pauseMs: 0,
    })
    expect(result).toEqual({
      text: 'Once upon a midnight dreary.',
      partial: false,
    })
  })
})

describe('parseEditionLinks', () => {
  it('lists the works on an editions page with their descriptions, and skips other namespaces', () => {
    const wikitext = [
      '{{disambiguation}}',
      '* [[The Open Window (Longfellow)|The Open Window]], a poem by Henry Wadsworth Longfellow.',
      '* [[The Open Window (Saki)|The Open Window]], a short story by [[Author:Saki|Saki]] (H. H. Munro).',
      '* [[Author:Saki]]',
      '* [[Category:Stories]]',
    ].join('\n')
    expect(parseEditionLinks(wikitext)).toEqual([
      {
        title: 'The Open Window (Longfellow)',
        note: 'a poem by Henry Wadsworth Longfellow.',
      },
      {
        title: 'The Open Window (Saki)',
        note: 'a short story by Saki (H. H. Munro).',
      },
    ])
  })
})

describe('pickWikisource', () => {
  let dir: URL
  beforeEach(async () => {
    dir = pathToFileURL(join(await mkdtemp(join(tmpdir(), 'sg-ws-')), '/'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const world = () =>
    fakeWikisource({
      'The Mouse': {
        templates: ['Template:PD-US'],
        content: '{{header|author=Saki}}',
        html: page('<p>A very short tale of a mouse.</p>'),
      },
      'Modern Story': {
        categories: ['Category:Fiction'],
        content: '{{header|author=Somebody}}',
        html: page('<p>Still in copyright.</p>'),
      },
      'The Open Window': {
        templates: ['Template:Disambiguation'],
        content:
          '* [[The Open Window (Saki)|The Open Window]], a short story by Saki.\n* [[Modern Story]], a story.',
      },
      'The Open Window (Saki)': {
        templates: ['Template:PD-US'],
        content: '{{header|author=Saki}}',
      },
    })

  it('refuses a page not marked US public domain, and never fetches its text', async () => {
    const wiki = world()
    await expect(
      pickWikisource('Modern Story', {
        fetchFn: wiki.fetchFn,
        cacheDir: dir,
        pauseMs: 0,
      }),
    ).rejects.toBeInstanceOf(NotPublicDomain)
    await expect(
      pickWikisource('Modern Story', {
        fetchFn: wiki.fetchFn,
        cacheDir: dir,
        pauseMs: 0,
      }),
    ).rejects.toThrow(/not marked us public domain/i)
    expect(wiki.calls.some((c) => c.params.get('action') === 'parse')).toBe(
      false,
    )
  })

  it('lists the editions of a disambiguation page as choices, and greys out the ones not public domain', async () => {
    const picked = await pickWikisource('The Open Window', {
      fetchFn: world().fetchFn,
      cacheDir: dir,
      pauseMs: 0,
    })
    expect(picked.kind).toBe('editions')
    if (picked.kind !== 'editions') return
    expect(picked.choices.map((c) => [c.key, c.license, c.note])).toEqual([
      ['The Open Window (Saki)', 'PD-US', 'a short story by Saki.'],
      ['Modern Story', null, 'Not marked US public domain'],
    ])
  })

  it('fetches a public-domain page as text, caches it as ws-<safe-title>.txt, then reads the cache', async () => {
    const wiki = world()
    const first = await pickWikisource('The Mouse', {
      fetchFn: wiki.fetchFn,
      cacheDir: dir,
      pauseMs: 0,
    })
    expect(first).toMatchObject({
      kind: 'text',
      title: 'The Mouse',
      author: 'Saki',
      license: { tag: 'PD-US' },
      url: 'https://en.wikisource.org/wiki/The_Mouse',
      text: 'A very short tale of a mouse.',
      partial: false,
    })
    expect(await readFile(new URL('ws-the-mouse.txt', dir), 'utf8')).toBe(
      'A very short tale of a mouse.',
    )
    const callsBefore = wiki.calls.length
    const again = await pickWikisource('The Mouse', {
      fetchFn: wiki.fetchFn,
      cacheDir: dir,
      pauseMs: 0,
    })
    expect(again).toEqual(first)
    expect(wiki.calls).toHaveLength(callsBefore)
  })

  it('says so when there is no such page', async () => {
    await expect(
      pickWikisource('Nothing Here', {
        fetchFn: world().fetchFn,
        cacheDir: dir,
        pauseMs: 0,
      }),
    ).rejects.toThrow(/no Wikisource page called/)
  })
})
