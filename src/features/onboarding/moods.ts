/** The 12 moods, each with a colour swatch. The name is always shown too, so colour is never the only cue. */
export const MOODS = [
  { id: 'cozy', label: 'Cozy', color: '#d98c4a' },
  { id: 'eerie', label: 'Eerie', color: '#6c5b9e' },
  { id: 'funny', label: 'Funny', color: '#e5b92f' },
  { id: 'romantic', label: 'Romantic', color: '#d4577a' },
  { id: 'thoughtful', label: 'Thoughtful', color: '#4a7fa8' },
  { id: 'adventurous', label: 'Adventurous', color: '#3f9a6c' },
  { id: 'melancholy', label: 'Melancholy', color: '#5f7080' },
  { id: 'uplifting', label: 'Uplifting', color: '#e8924a' },
  { id: 'tense', label: 'Tense', color: '#b8453a' },
  { id: 'whimsical', label: 'Whimsical', color: '#3aa3a0' },
  { id: 'dark', label: 'Dark', color: '#3a3a4a' },
  { id: 'hopeful', label: 'Hopeful', color: '#8ab34a' },
] as const

/**
 * The six moods on the first-run welcome: one tap on any of them builds the first Your Shortlist.
 * Each has at least 20 works in the catalog, so the first list is never thin.
 */
export const FIRST_RUN_MOOD_IDS = [
  'funny',
  'eerie',
  'tense',
  'thoughtful',
  'adventurous',
  'hopeful',
] as const

export const FIRST_RUN_MOODS = FIRST_RUN_MOOD_IDS.map((id) =>
  MOODS.find((m) => m.id === id)!,
)

export const MIN_MOODS = 2
export const MAX_MOODS = 5

/** "When do you usually read?" and the starting length each suggests (a ladder level: 0 = under 10 min, 3 = over an hour). */
export const READING_TIMES = [
  { id: 'commute', label: 'Commute', ladder: 0 },
  { id: 'lunch', label: 'Lunch break', ladder: 1 },
  { id: 'evenings', label: 'Evenings', ladder: 2 },
  { id: 'weekends', label: 'Weekends', ladder: 3 },
] as const

/** The starting length preference for the chosen times: their average, rounded. */
export function ladderFor(times: string[]): number | undefined {
  const levels: number[] = READING_TIMES.filter((t) =>
    times.includes(t.id),
  ).map((t) => t.ladder)
  if (levels.length === 0) return undefined
  return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
}
