import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

const base = { startX: 200, startY: 400, ms: 200, screenWidth: 400 }

describe('swipeDirection', () => {
  it('turns forward on a swipe left and back on a swipe right', () => {
    expect(swipeDirection({ ...base, endX: 80, endY: 410 })).toBe('next')
    expect(swipeDirection({ ...base, endX: 320, endY: 390 })).toBe('prev')
  })

  it('ignores a mostly vertical swipe, a short one and a slow one', () => {
    expect(swipeDirection({ ...base, endX: 140, endY: 600 })).toBeNull()
    expect(swipeDirection({ ...base, endX: 170, endY: 400 })).toBeNull()
    expect(
      swipeDirection({ ...base, endX: 80, endY: 400, ms: 1500 }),
    ).toBeNull()
  })

  it('ignores a swipe that starts within 24 px of either screen edge', () => {
    expect(
      swipeDirection({ ...base, startX: 10, endX: 200, endY: 400 }),
    ).toBeNull()
    expect(
      swipeDirection({ ...base, startX: 390, endX: 200, endY: 400 }),
    ).toBeNull()
    expect(swipeDirection({ ...base, startX: 30, endX: 200, endY: 400 })).toBe(
      'prev',
    )
  })
})
