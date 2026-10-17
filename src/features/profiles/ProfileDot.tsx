import type { ProfileColor } from '../../stores'
import { PROFILE_COLOR_FILL } from './colors'

/** A small colour dot. Decorative: the name is always written next to it. */
export function ProfileDot({
  color,
  size = 'md',
  dashed = false,
}: {
  color: ProfileColor
  size?: 'sm' | 'md'
  /** The guest's dot has a dashed ring. */
  dashed?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 ${
        dashed ? 'border-dashed' : ''
      } border-ink ${size === 'sm' ? 'size-3' : 'size-6'}`}
      style={{ backgroundColor: PROFILE_COLOR_FILL[color] }}
    />
  )
}
