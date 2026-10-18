// Story Guide: a local hackathon tool. It asks Gemma (Gemma 4 through the Gemini API) to write a
// spoiler-free hook and blurb from the first third of a story, and to label moods, content notes
// and an age band from the whole story, then shows the results beside the curated ones.
//
// Run: npm run story-guide   (needs tools/story-guide/.env, see .env.example)
// Build-time tool: it never ships in the app. The API key stays in this server process; the page
// never sees it.

import { fileURLToPath } from 'node:url'
import express from 'express'
import { MOODS, buildCatalog } from '../../scripts/build-catalog.ts'
import type { CatalogEntry } from '../../scripts/build-catalog.ts'
import { loadCatalog } from './catalog.ts'
import {
  LENGTH_FILTERS,
  MAX_ANALYSED_WORDS,
  SourceError,
  capWords,
  type LengthFilter,
} from './common.ts'
import {
  estimateWords,
  findBook,
  gutenbergPage,
  loadBookText,
  searchGutenberg,
  trimGutenbergText,
} from './gutenberg.ts'
import {
  AGE_REASON_MAX_WORDS,
  BLURB_MAX_WORDS,
  HOOK_MAX_WORDS,
  analysisPrompt,
  askForJson,
  checkDescription,
  fetchWithRetries,
  firstThird,
  openingPrompt,
  readAnalysis,
  readOpening,
} from './guide.ts'
import { SOURCES, searchSources, type SourceChoice } from './search.ts'
import {
  NotPublicDomain,
  type WikisourceText,
  describePages,
  pickWikisource,
  searchWikisource,
} from './wikisource.ts'

const ROOT = new URL('./', import.meta.url)
try {
  process.loadEnvFile(fileURLToPath(new URL('.env', ROOT)))
} catch {
  // No .env file: the page will say the key is missing.
}

const MODEL = process.env.GEMMA_MODEL?.trim() || 'gemma-4-31b-it'
const PORT = Number(process.env.STORY_GUIDE_PORT) || 5180
const MIN_PASTED_WORDS = 150

const apiKey = (): string => process.env.GEMINI_API_KEY?.trim() ?? ''

// The catalog is built with the app's own build code, so a story's text is exactly what readers
// get: its start and end ranges, trims and cleanups. Built once, when the server starts.
let entries: CatalogEntry[] = []
let rangeText: Record<string, string> = {}
let catalogError = ''
try {
  const built = buildCatalog()
  entries = built.entries
  rangeText = built.rangeText
} catch (error) {
  catalogError = error instanceof Error ? error.message : String(error)
  console.error(`story-guide: could not build the catalog: ${catalogError}`)
}

/** One call to the Gemini API. All instructions are in the user message (Gemma takes no system prompt). */
async function askGemma(prompt: string): Promise<string> {
  const key = apiKey()
  const response = await fetchWithRetries(
    () =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
          }),
          signal: AbortSignal.timeout(180_000),
        },
      ),
    {
      // Terminal only, and only the status: never the key or the request.
      onRetry: (status, attempt, waitMs) =>
        console.error(
          `story-guide: Gemini API answered ${status}; retry ${attempt} of 3 in ${waitMs / 1000}s`,
        ),
    },
  )
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string }
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] }
    }[]
  }
  if (!response.ok) {
    console.error(
      `story-guide: Gemini API call failed with status ${response.status}`,
    )
    const message = body.error?.message ?? `HTTP ${response.status}`
    throw new Error(`Gemini API: ${message.split(key).join('[key]')}`)
  }
  const parts = body.candidates?.[0]?.content?.parts ?? []
  // Skip any "thinking" parts; keep the answer.
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  if (!text.trim()) throw new Error('Gemma sent back an empty reply.')
  return text
}

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(express.static(fileURLToPath(new URL('public/', ROOT))))

app.get('/api/status', (_req, res) => {
  res.json({
    keySet: apiKey() !== '',
    model: MODEL,
    catalogReady: catalogError === '',
    catalogError,
    storyCount: entries.length,
    moods: MOODS,
  })
})

app.get('/api/stories', (_req, res) => {
  res.json(
    entries.map((e) => ({
      id: e.id,
      title: e.title,
      author: e.author,
      minutes: e.readingMinutes,
      words: e.wordCount,
    })),
  )
})

/** Titles in the Dog-Eared Tales catalog that come from this Gutenberg book (empty: none). */
const catalogTitlesFrom = (gutenbergId: number): string[] =>
  entries
    .filter((e) => e.id.startsWith(`pg-${gutenbergId}-`))
    .map((e) => e.title)

function sendSourceError(res: express.Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`story-guide: ${message}`)
  const status =
    error instanceof NotPublicDomain
      ? 403
      : error instanceof SourceError
        ? 502
        : 500
  res.status(status).json({
    error:
      error instanceof SourceError
        ? message
        : 'Something went wrong on the server. See the terminal.',
  })
}

/** What the page and the analysis need to know about a book from outside the catalog. */
interface Outside {
  source: 'gutenberg' | 'wikisource'
  /** The text to analyse: at most the first 20,000 words. */
  story: string
  title: string
  author: string
  url: string
  totalWords: number
  analysedWords: number
  truncated: boolean
  /** Wikisource: the work has more chapters than were fetched (fetching stops at 20,000 words). */
  partial: boolean
  limit: number
  inCatalog: string[]
  license?: { tag: string; from?: string }
}

async function outsideGutenberg(id: number): Promise<Outside> {
  const book = await findBook(id)
  const capped = capWords(
    trimGutenbergText(await loadBookText(book)),
    MAX_ANALYSED_WORDS,
  )
  return {
    source: 'gutenberg',
    story: capped.text,
    title: book.title,
    author: book.author,
    url: gutenbergPage(id),
    totalWords: capped.totalWords,
    analysedWords: capped.analysedWords,
    truncated: capped.truncated,
    partial: false,
    limit: MAX_ANALYSED_WORDS,
    inCatalog: catalogTitlesFrom(id),
  }
}

/** An Outside without its text: what is sent to the page. */
const describeOutside = (outside: Outside): Omit<Outside, 'story'> =>
  Object.fromEntries(
    Object.entries(outside).filter(([key]) => key !== 'story'),
  ) as Omit<Outside, 'story'>

/** One search over Project Gutenberg, Wikisource or both, with a length filter. */
app.get('/api/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const source = (SOURCES as readonly string[]).includes(
    String(req.query.source),
  )
    ? (req.query.source as SourceChoice)
    : 'both'
  const length = (LENGTH_FILTERS as readonly string[]).includes(
    String(req.query.length),
  )
    ? (req.query.length as LengthFilter)
    : 'any'
  if (!q) {
    res.status(400).json({ error: 'Type something to search for.' })
    return
  }
  try {
    res.json(
      await searchSources(q, source, length, {
        gutenbergSearch: (query, limit) => searchGutenberg(query, limit),
        gutenbergWords: (ids) => estimateWords(ids),
        wikisourceSearch: (query, limit) => searchWikisource(query, limit),
        wikisourceDescribe: (titles) => describePages(titles),
      }),
    )
  } catch (error) {
    sendSourceError(res, error)
  }
})

/** Picks a Gutenberg book: downloads its text (once, then cached), trims it and counts the words. */
app.get('/api/gutenberg/book/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'That is not a Gutenberg id.' })
    return
  }
  try {
    res.json(describeOutside(await outsideGutenberg(id)))
  } catch (error) {
    sendSourceError(res, error)
  }
})

/**
 * Picks a Wikisource page. Public-domain pages only. An editions page (versions or
 * disambiguation) answers with its editions as choices.
 */
app.get('/api/wikisource/book', async (req, res) => {
  const title =
    typeof req.query.title === 'string' ? req.query.title.trim() : ''
  if (!title) {
    res.status(400).json({ error: 'No Wikisource page was given.' })
    return
  }
  try {
    const picked = await pickWikisource(title)
    if (picked.kind === 'editions') {
      res.json(picked)
      return
    }
    res.json({ kind: 'text', ...describeOutside(wikisourceOutside(picked)) })
  } catch (error) {
    sendSourceError(res, error)
  }
})

function wikisourceOutside(picked: WikisourceText): Outside {
  const capped = capWords(picked.text, MAX_ANALYSED_WORDS)
  return {
    source: 'wikisource',
    story: capped.text,
    title: picked.title,
    author: picked.author,
    url: picked.url,
    totalWords: capped.totalWords,
    analysedWords: capped.analysedWords,
    truncated: capped.truncated,
    partial: picked.partial,
    limit: MAX_ANALYSED_WORDS,
    inCatalog: [],
    license: picked.license,
  }
}

app.post('/analyze', async (req, res) => {
  if (!apiKey()) {
    res.status(503).json({
      error:
        'GEMINI_API_KEY is missing. Copy tools/story-guide/.env.example to tools/story-guide/.env, add your key, and restart.',
    })
    return
  }
  const {
    id,
    gutenbergId,
    wikisourceTitle,
    text: pasted,
    title,
  } = (req.body ?? {}) as {
    id?: unknown
    gutenbergId?: unknown
    wikisourceTitle?: unknown
    text?: unknown
    title?: unknown
  }

  let story = ''
  let curated: CatalogEntry | undefined
  let outside: Outside | undefined
  let label =
    typeof title === 'string' && title.trim() ? title.trim() : 'Pasted text'
  if (typeof id === 'string' && id) {
    curated = entries.find((e) => e.id === id)
    if (!curated || rangeText[id] === undefined) {
      res.status(404).json({ error: `No catalog story with id "${id}".` })
      return
    }
    story = rangeText[id]
    label = `${curated.title}, ${curated.author}`
  } else if (gutenbergId !== undefined && gutenbergId !== null) {
    const number = Number(gutenbergId)
    if (!Number.isInteger(number) || number <= 0) {
      res.status(400).json({ error: 'That is not a Gutenberg id.' })
      return
    }
    try {
      outside = await outsideGutenberg(number)
    } catch (error) {
      sendSourceError(res, error)
      return
    }
  } else if (typeof wikisourceTitle === 'string' && wikisourceTitle.trim()) {
    try {
      const picked = await pickWikisource(wikisourceTitle.trim())
      if (picked.kind === 'editions') {
        res.status(400).json({
          error: `"${picked.title}" lists several editions. Pick one of them first.`,
        })
        return
      }
      outside = wikisourceOutside(picked)
    } catch (error) {
      sendSourceError(res, error)
      return
    }
  } else if (typeof pasted === 'string') {
    story = pasted.trim()
  }
  if (outside) {
    // The full-story call reads at most the first 20,000 words; the blurb call then uses the
    // first third of what is read.
    story = outside.story
    label = `${outside.title}, ${outside.author}`
  }
  const totalWords = story.match(/\S+/g)?.length ?? 0
  if (totalWords < MIN_PASTED_WORDS) {
    res.status(400).json({
      error: `Pick a catalog story, or paste at least ${MIN_PASTED_WORDS} words of a story (got ${totalWords}).`,
    })
    return
  }

  try {
    const opening = firstThird(story)
    const [described, analysed] = await Promise.all([
      askForJson(askGemma, openingPrompt(opening.text), readOpening),
      askForJson(askGemma, analysisPrompt(story, MOODS), (j) =>
        readAnalysis(j, MOODS),
      ),
    ])
    res.json({
      label,
      model: MODEL,
      opening: { words: opening.words, totalWords: opening.totalWords },
      gemma: {
        hook: described.value.hook,
        blurb: described.value.blurb,
        ...analysed.value,
        retried: described.retried || analysed.retried,
      },
      checks: {
        hook: checkDescription(described.value.hook, HOOK_MAX_WORDS, story),
        blurb: checkDescription(described.value.blurb, BLURB_MAX_WORDS, story),
        ageReason: {
          words: analysed.value.ageReason.match(/\S+/g)?.length ?? 0,
          limit: AGE_REASON_MAX_WORDS,
        },
      },
      source: outside
        ? { kind: outside.source, ...describeOutside(outside) }
        : { kind: curated ? 'catalog' : 'pasted' },
      curated: curated && {
        hook: curated.hook,
        blurb: curated.blurb,
        moods: curated.moods,
        contentNotes: curated.contentNotes,
        review: curated.review,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`story-guide: ${message}`)
    res.status(502).json({ error: message })
  }
})

// Get Gutenberg's catalog file ready in the background (downloaded once, then refreshed weekly).
void loadCatalog()
  .then((index) =>
    console.log(
      `Project Gutenberg catalog ready: ${index.rows.length} English texts`,
    ),
  )
  .catch((error: Error) =>
    console.error(
      `story-guide: Gutenberg catalog not ready (${error.message}); Gutenberg search will not work until it downloads`,
    ),
  )

// Only this computer can reach the tool.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Story Guide: http://localhost:${PORT}/  (model ${MODEL})`)
  if (!apiKey())
    console.log('GEMINI_API_KEY is not set: the page will ask you to add it.')
})
