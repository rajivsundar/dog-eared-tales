import type { ProfileColor } from '../../stores'
import { PROFILE_COLORS } from '../../stores/types'

/** The fill for each profile colour. Dots also carry a ring, so they read on every theme. */
export const PROFILE_COLOR_FILL: Record<ProfileColor, string> = {
  rust: '#b4532a',
  forest: '#2f6f4f',
  ocean: '#2b6cb0',
  plum: '#7b3f8f',
  gold: '#c99a1d',
  slate: '#5b6b7a',
}

/** "Rust", "Forest" ... so colour is never the only cue. */
export function colorName(color: ProfileColor): string {
  return PROFILE_COLORS.find((c) => c.id === color)?.name ?? color
}
