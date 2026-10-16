const WORD = /[A-Za-z0-9À-￿]+(?:['’-][A-Za-z0-9À-￿]+)*/g

/** The same word count the catalog script uses, so progress agrees with the catalog. */
export function countWords(text: string): number {
  return (text.match(WORD) ?? []).length
}
