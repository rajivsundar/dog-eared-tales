import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SleepingDog } from './SleepingDog'
import source from './SleepingDog.tsx?raw'

describe('SleepingDog', () => {
  it('is decorative: hidden from screen readers, with no title, text or image', () => {
    render(<SleepingDog />)
    const svg = screen.getByTestId('welcome-dog')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg.querySelector('title, desc, text, image')).toBeNull()
    expect(svg).not.toHaveAttribute('role', 'img')
  })

  it('takes every colour from the theme tokens, so it follows light, dark and fall', () => {
    render(<SleepingDog />)
    const svg = screen.getByTestId('welcome-dog')
    const tokens = /^(ink|muted|line|accent|page|surface)(\/\d+)?$/
    const colours = new Set<string>()
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      for (const name of el.classList) {
        const m = /^(?:fill|stroke)-(.+)$/.exec(name)
        if (m && m[1] !== 'none') colours.add(m[1])
      }
      // No fixed colours in attributes.
      for (const attr of ['fill', 'stroke'])
        expect(el.getAttribute(attr)).toBeNull()
    }
    expect(colours.size).toBeGreaterThan(0)
    for (const c of colours) expect(c).toMatch(tokens)
    // The folded corner is the only accent-coloured part.
    expect(svg.querySelectorAll('[class*="accent"]')).toHaveLength(1)
  })

  it('has no fixed colours in its source', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source).not.toMatch(/\b(rgb|hsl)a?\(/)
  })

  it('stays under 10 KB', () => {
    expect(new Blob([source]).size).toBeLessThan(10 * 1024)
  })
})
