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
import {
  GutenbergError,
  MAX_ANALYSED_WORDS,
  capWords,
  findBook,
  gutenbergPage,
  loadBookText,
  searchGutendex,
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

/** Project Gutenberg search, through Gutendex. The browser never calls Gutendex itself. */
app.get('/api/gutenberg/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    res.status(400).json({ error: 'Type something to search for.' })
    return
  }
  try {
    res.json(await searchGutendex(q))
  } catch (error) {
    sendGutenbergError(res, error)
  }
})

/** Picks a book: downloads its text (once, then cached), trims it and counts the words. */
app.get('/api/gutenberg/book/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'That is not a Gutenberg id.' })
    return
  }
  try {
    const book = await findBook(id)
    const text = trimGutenbergText(await loadBookText(book))
    const { analysedWords, totalWords, truncated } = capWords(
      text,
      MAX_ANALYSED_WORDS,
    )
    res.json({
      id,
      title: book.title,
      author: book.author,
      url: gutenbergPage(id),
      totalWords,
      analysedWords,
      truncated,
      limit: MAX_ANALYSED_WORDS,
      inCatalog: catalogTitlesFrom(id),
    })
  } catch (error) {
    sendGutenbergError(res, error)
  }
})

/** Titles in the Dog-Eared Tales catalog that come from this Gutenberg book (empty: none). */
const catalogTitlesFrom = (gutenbergId: number): string[] =>
  entries
    .filter((e) => e.id.startsWith(`pg-${gutenbergId}-`))
    .map((e) => e.title)

function sendGutenbergError(res: express.Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`story-guide: ${message}`)
  res.status(error instanceof GutenbergError ? 502 : 500).json({
    error:
      error instanceof GutenbergError
        ? message
        : 'Something went wrong on the server. See the terminal.',
  })
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
    text: pasted,
    title,
  } = (req.body ?? {}) as {
    id?: unknown
    gutenbergId?: unknown
    text?: unknown
    title?: unknown
  }

  let story = ''
  let curated: CatalogEntry | undefined
  let gutenberg:
    | {
        id: number
        title: string
        author: string
        url: string
        totalWords: number
        analysedWords: number
        truncated: boolean
        limit: number
        inCatalog: string[]
      }
    | undefined
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
      const book = await findBook(number)
      const trimmed = trimGutenbergText(await loadBookText(book))
      // The full-story call reads at most the first 20,000 words; the blurb call then uses
      // the first third of what is read.
      const capped = capWords(trimmed, MAX_ANALYSED_WORDS)
      story = capped.text
      label = `${book.title}, ${book.author}`
      gutenberg = {
        id: number,
        title: book.title,
        author: book.author,
        url: gutenbergPage(number),
        totalWords: capped.totalWords,
        analysedWords: capped.analysedWords,
        truncated: capped.truncated,
        limit: MAX_ANALYSED_WORDS,
        inCatalog: catalogTitlesFrom(number),
      }
    } catch (error) {
      sendGutenbergError(res, error)
      return
    }
  } else if (typeof pasted === 'string') {
    story = pasted.trim()
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
      source: gutenberg
        ? { kind: 'gutenberg', ...gutenberg }
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

// Only this computer can reach the tool.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Story Guide: http://localhost:${PORT}/  (model ${MODEL})`)
  if (!apiKey())
    console.log('GEMINI_API_KEY is not set: the page will ask you to add it.')
})
