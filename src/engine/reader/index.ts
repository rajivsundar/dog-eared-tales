// Other code imports the reader from here and uses the ReaderEngine interface.
import { FoliateReaderEngine } from './FoliateReaderEngine'
import type { ReaderEngine } from './types'

export * from './types'
export { DEFAULT_WORDS_PER_MINUTE } from './rangeRules'
export { THEME_COLORS, resolveTheme } from './readerStyle'

/** Makes a reader that draws into the given element. */
export function createReaderEngine(container: HTMLElement): ReaderEngine {
  return new FoliateReaderEngine({ container })
}
