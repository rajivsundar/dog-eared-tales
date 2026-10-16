import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'

const h = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(async () => {}),
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [h.needRefresh, h.setNeedRefresh],
    offlineReady: [false, () => {}],
    updateServiceWorker: h.updateServiceWorker,
  }),
}))

beforeEach(() => {
  h.needRefresh = false
  vi.clearAllMocks()
})

describe('UpdateBanner', () => {
  it('shows nothing while there is no new version', () => {
    render(<UpdateBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows "New version available · Update" when a new version is ready', () => {
    h.needRefresh = true
    render(<UpdateBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'New version available ·',
    )
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('does not reload by itself: only the Update button applies it', () => {
    h.needRefresh = true
    render(<UpdateBanner />)
    expect(h.updateServiceWorker).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(h.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('can be dismissed, and its buttons are big enough to tap', () => {
    h.needRefresh = true
    render(<UpdateBanner />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(h.setNeedRefresh).toHaveBeenCalledWith(false)
    for (const name of ['Update', 'Dismiss']) {
      expect(screen.getByRole('button', { name }).className).toMatch(/min-h-11/)
    }
  })
})
