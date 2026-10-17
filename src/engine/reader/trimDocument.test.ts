// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  findText,
  removeBefore,
  removeBeforeText,
  removeFrom,
  removeFromText,
} from './trimDocument'

function page(html: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${html}</body></html>`,
    'text/html',
  )
}

/** The text left on the page, with a space between separate pieces. */
const text = (doc: Document): string => {
  const pieces: string[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const piece = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (piece) pieces.push(piece)
  }
  return pieces.join(' ')
}

describe('cutting text from a page', () => {
  it('removes everything before the story starts', () => {
    const doc = page(
      '<p>Old story.</p><h2 id="s">New Story</h2><p>Its text.</p>',
    )
    removeBefore(doc.getElementById('s')!)
    expect(text(doc)).toBe('New Story Its text.')
  })

  it('removes the next story and everything after it', () => {
    const doc = page(
      '<h2>This</h2><p>Its text.</p><h2 id="e">Next</h2><p>Other text.</p>',
    )
    removeFrom(doc.getElementById('e')!)
    expect(text(doc)).toBe('This Its text.')
  })

  it('does both in one chapter file', () => {
    const doc = page(
      '<p>Before.</p><h2 id="s">Mine</h2><p>Mine too.</p><h2 id="e">Later</h2><p>After.</p>',
    )
    removeFrom(doc.getElementById('e')!)
    removeBefore(doc.getElementById('s')!)
    expect(text(doc)).toBe('Mine Mine too.')
  })

  it('works when the marker sits deep inside a wrapper', () => {
    const doc = page(
      '<div><p>Old.</p><div><h2 id="s">Mine</h2><p>Text.</p></div></div><div><p>More.</p></div>',
    )
    removeBefore(doc.getElementById('s')!)
    expect(text(doc)).toBe('Mine Text. More.')
  })

  it('keeps text that sits before an inline marker in the same paragraph out of the story', () => {
    const doc = page(
      '<p>Tail of the old story. <a id="s"></a>Start of mine.</p><p>More of mine.</p>',
    )
    removeBefore(doc.getElementById('s')!)
    expect(text(doc)).toBe('Start of mine. More of mine.')
  })

  it('accepts a Range as well as an element', () => {
    const doc = page('<p>Old.</p><p id="s">New.</p>')
    const range = doc.createRange()
    range.selectNode(doc.getElementById('s')!)
    removeBefore(range)
    expect(text(doc)).toBe('New.')
  })
})

describe('cutting a page at some text', () => {
  it('finds text that runs across paragraphs', () => {
    const doc = page(
      '<p>Before.</p><p>Printed by</p><p>Morrison &amp; Gibb</p>',
    )
    expect(findText(doc, 'Printed by Morrison & Gibb')).not.toBeNull()
    expect(findText(doc, 'No such text')).toBeNull()
  })

  it('removes the text and everything after it, keeping what came before', () => {
    const doc = page(
      '<p>The story ends here. The following is a list of changes made.</p><p>Fixes.</p>',
    )
    removeFromText(findText(doc, 'The following is a list')!)
    expect(text(doc)).toBe('The story ends here.')
  })

  it('removes everything before the text, keeping the text and what follows', () => {
    const doc = page('<p>Notes.</p><p>Chapter one. It begins.</p><p>More.</p>')
    removeBeforeText(findText(doc, 'It begins')!)
    expect(text(doc)).toBe('It begins. More.')
  })
})
