// The automated checks for descriptions written by AI that no person has read yet (curation
// records with review: "auto"). A record that fails one is held back from the catalog, and the
// build says which record and why. Schema and vocabulary errors are separate and stop the build.

/**
 * Words and phrases a hook or blurb may never use. They hint at a story's turn or ending, or name
 * its outcome. Matched as whole words, ignoring case. This is the one place the list is kept;
 * docs/DECISIONS.md records the same list.
 */
export const BANNED_WORDS: readonly string[] = [
  'and then',
  'twist',
  'twists',
  'irony',
  'ironic',
  'surprise',
  'surprises',
  'surprising',
  'unexpected',
  'unexpectedly',
  'heartbreaking',
  'jealousy',
  'refusal',
  'regret',
]

const escape = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One whole-word matcher per banned entry; spaces inside a phrase match any run of spaces. */
const BANNED_MATCHERS: { word: string; pattern: RegExp }[] = BANNED_WORDS.map(
  (word) => ({
    word,
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])${word.split(' ').map(escape).join('\\s+')}(?![\\p{L}\\p{N}])`,
      'iu',
    ),
  }),
)

/** The banned words and phrases found in a text (whole words, any case). */
export function bannedWordsIn(text: string): string[] {
  return BANNED_MATCHERS.filter(({ pattern }) => pattern.test(text)).map(
    ({ word }) => word,
  )
}

/** The words of a text, lower-case, with curly apostrophes made straight. */
export function wordsOf(text: string): string[] {
  return (text.match(/[A-Za-z0-9À-￿]+(?:['’-][A-Za-z0-9À-￿]+)*/g) ?? []).map(
    (w) => w.toLowerCase().replace(/’/g, "'"),
  )
}

/** The first run of six or more words a description copies from the story, or null. */
export function copiedRun(source: string, description: string): string | null {
  const text = wordsOf(source)
  const grams = new Set<string>()
  for (let i = 0; i + 6 <= text.length; i++)
    grams.add(text.slice(i, i + 6).join(' '))
  const mine = wordsOf(description)
  for (let i = 0; i + 6 <= mine.length; i++) {
    const gram = mine.slice(i, i + 6).join(' ')
    if (grams.has(gram)) return gram
  }
  return null
}

/** Why an AI-written record fails the automated checks (empty when it passes). */
export function automatedCheckProblems(
  entry: { hook: string; blurb: string },
  storyText: string,
): string[] {
  const problems: string[] = []
  for (const label of ['hook', 'blurb'] as const) {
    const banned = bannedWordsIn(entry[label])
    if (banned.length > 0) {
      problems.push(
        `${label} uses ${banned.map((w) => `"${w}"`).join(', ')}, which hints at the story's turn or outcome`,
      )
    }
    const copied = copiedRun(storyText, entry[label])
    if (copied) {
      problems.push(`${label} copies six words from the story: "${copied}"`)
    }
  }
  const front = frontMatterIn(storyText)
  if (front.length > 0) {
    problems.push(
      `the text range opens with front matter (${front.join(', ')}), not the story`,
    )
  }
  return problems
}

/** How much of a story's opening is searched for Project Gutenberg front matter. */
const FRONT_MATTER_WINDOW = 1500

const FRONT_MATTER: { label: string; pattern: RegExp }[] = [
  // At the start of a line: the credit, not a sentence such as "Society is produced by our wants".
  { label: '"Produced by"', pattern: /(?:^|\n)[ \t]*produced\s+by\b/i },
  { label: '"E-text prepared by"', pattern: /\be-?text\s+prepared\s+by\b/i },
  { label: 'a credits line', pattern: /\bdistributed\s+proofreading\b/i },
  { label: 'a transcriber note', pattern: /\btranscriber['’]?s?\s+notes?\b/i },
  { label: 'a printer note', pattern: /\bprinter['’]?s?\s+notes?\b/i },
  { label: 'a foreword', pattern: /\bforeword\b/i },
]

/**
 * The kinds of Project Gutenberg front matter (credits, transcriber or printer notes, a foreword)
 * found in the opening of a story's text. A story's text range should start at the story itself.
 */
export function frontMatterIn(storyText: string): string[] {
  const opening = storyText.slice(0, FRONT_MATTER_WINDOW)
  return FRONT_MATTER.filter(({ pattern }) => pattern.test(opening)).map(
    ({ label }) => label,
  )
}
