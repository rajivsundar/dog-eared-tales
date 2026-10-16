import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReaderStyle } from '../../engine/reader'
import { AaPanel } from './AaPanel'

const style: ReaderStyle = { font: 'literata', sizeStep: 5, theme: 'paper' }

function setup(over: Partial<ReaderStyle> = {}) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  render(
    <AaPanel
      style={{ ...style, ...over }}
      onChange={onChange}
      onClose={onClose}
    />,
  )
  return { onChange, onClose }
}

describe('Aa panel', () => {
  it('offers the four fonts, with the current one chosen', () => {
    setup()
    for (const name of [
      'Literata',
      'Atkinson Hyperlegible',
      'OpenDyslexic',
      'System serif',
    ]) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('radio', { name: 'Literata' })).toBeChecked()
  })

  it('offers Paper, Sepia, Night and Black, with the current theme chosen', () => {
    setup({ theme: 'sepia' })
    for (const name of ['Paper', 'Sepia', 'Night', 'Black']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('radio', { name: 'Sepia' })).toBeChecked()
  })

  it('also offers to match the device, for the "system" theme', () => {
    setup({ theme: 'system' })
    expect(screen.getByRole('radio', { name: 'Match device' })).toBeChecked()
  })

  it('reports a font change at once', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: 'OpenDyslexic' }))
    expect(onChange).toHaveBeenCalledWith({ font: 'opendyslexic' })
  })

  it('reports a theme change at once', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }))
    expect(onChange).toHaveBeenCalledWith({ theme: 'night' })
  })

  it('has a size slider from 1 to 10 showing the current step', () => {
    setup({ sizeStep: 7 })
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '1')
    expect(slider).toHaveAttribute('max', '10')
    expect(slider).toHaveValue('7')
    expect(screen.getByText(/Text size/)).toHaveTextContent(
      'Text size: 7 of 10',
    )
  })

  it('changes the size with the slider and the A buttons, never leaving 1 to 10', () => {
    const { onChange } = setup({ sizeStep: 5 })
    fireEvent.change(screen.getByRole('slider'), { target: { value: '9' } })
    expect(onChange).toHaveBeenLastCalledWith({ sizeStep: 9 })
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(onChange).toHaveBeenLastCalledWith({ sizeStep: 6 })
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    expect(onChange).toHaveBeenLastCalledWith({ sizeStep: 4 })
  })

  it('disables the size buttons at each end', () => {
    setup({ sizeStep: 1 })
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeEnabled()
  })

  it('closes', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
