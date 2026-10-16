import { describe, expect, it } from 'vitest'
import { DEFAULT_WELCOME, welcomeContent } from '../../app/seasons'
import type { CatalogEntry } from '../../catalog'
import { pickFeaturedStory, welcomeView } from './featuredStory'

function entry(id: string, changes: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    title: id,
    readingMinutes: 6,
    lengthClass: 'under10',
    coverUrl: `/covers/${id}.svg`,
    ...changes,
  } as CatalogEntry
}

const OPEN_WINDOW = entry('pg-269-the-open-window', {
  title: 'The Open Window',
})
const HEART = entry('pg-2148-the-tell-tale-heart', {
  title: 'The Tell-Tale Heart',
  readingMinutes: 9,
})
const USHER = entry('pg-932-the-fall-of-the-house-of-usher', {
  title: 'The Fall of the House of Usher',
  lengthClass: '10to30',
  readingMinutes: 20,
})
const GHOST = entry('pg-14522-the-canterville-ghost', {
  title: 'The Canterville Ghost',
  lengthClass: '30to60',
  readingMinutes: 50,
})
const MAGI = entry('pg-7256-the-gift-of-the-magi')
const catalog = [GHOST, MAGI, USHER, HEART, OPEN_WINDOW]

describe('the featured story', () => {
  it('is the season’s pick when it is under 10 minutes', () => {
    expect(pickFeaturedStory(catalog, HEART.id)).toBe(HEART)
  })

  it('is The Open Window out of season', () => {
    expect(pickFeaturedStory(catalog, DEFAULT_WELCOME.featuredStoryId)).toBe(
      OPEN_WINDOW,
    )
  })

  it('falls back to The Open Window if the season’s pick is too long', () => {
    expect(pickFeaturedStory(catalog, USHER.id)).toBe(OPEN_WINDOW)
    expect(pickFeaturedStory(catalog, GHOST.id)).toBe(OPEN_WINDOW)
  })

  it('falls back to The Open Window if the season’s pick is not in the catalog', () => {
    expect(pickFeaturedStory(catalog, 'pg-0-missing')).toBe(OPEN_WINDOW)
  })

  it('falls back to the first story under 10 minutes if The Open Window is gone too', () => {
    expect(pickFeaturedStory([GHOST, MAGI, USHER], 'pg-0-missing')).toBe(MAGI)
  })

  it('is undefined if nothing in the catalog is under 10 minutes', () => {
    expect(pickFeaturedStory([GHOST, USHER], HEART.id)).toBeUndefined()
    expect(pickFeaturedStory([], HEART.id)).toBeUndefined()
  })
})

describe('the welcome view', () => {
  it('pairs the fall content with its three covers, in order, and the Tell-Tale Heart', () => {
    const view = welcomeView(welcomeContent(new Date(2026, 9, 16)), catalog)
    expect(view.content.primaryButton).toBe('Turn over a new leaf')
    expect(view.featured).toBe(HEART)
    expect(view.covers.map((c) => c.id)).toEqual([HEART.id, USHER.id, GHOST.id])
  })

  it('pairs the default content with The Open Window and the default covers', () => {
    const view = welcomeView(welcomeContent(new Date(2026, 2, 3)), catalog)
    expect(view.content.primaryButton).toBe('Read a short story now')
    expect(view.featured).toBe(OPEN_WINDOW)
    expect(view.covers.map((c) => c.id)).toEqual([
      OPEN_WINDOW.id,
      HEART.id,
      MAGI.id,
    ])
  })

  it('leaves out covers that are not in the catalog', () => {
    const view = welcomeView(welcomeContent(new Date(2026, 2, 3)), [
      OPEN_WINDOW,
    ])
    expect(view.covers.map((c) => c.id)).toEqual([OPEN_WINDOW.id])
  })
})
