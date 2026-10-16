import type { TwiceToldDB } from './db'
import {
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  type Settings,
  type SettingsStore,
} from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  font: 'literata',
  textSize: 5,
  mix: 'default',
  aiPrefs: {},
  contentFilters: {},
}

export function createSettingsStore(db: TwiceToldDB): SettingsStore {
  async function get(): Promise<Settings> {
    const saved = await db.settings.get('settings')
    return { ...DEFAULT_SETTINGS, ...saved }
  }
  return {
    get,
    async update(changes) {
      const size = changes.textSize
      if (
        size !== undefined &&
        (!Number.isInteger(size) ||
          size < MIN_TEXT_SIZE ||
          size > MAX_TEXT_SIZE)
      ) {
        throw new RangeError(
          `textSize must be a whole number from ${MIN_TEXT_SIZE} to ${MAX_TEXT_SIZE}`,
        )
      }
      const next: Settings = { ...(await get()), ...changes, id: 'settings' }
      await db.settings.put(next)
      return next
    },
  }
}
