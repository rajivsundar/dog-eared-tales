// A story can start or end in the middle of a chapter file. These helpers cut the text that is
// not part of the story out of the page being shown, so the reader never sees it.
// They only change the copy on screen. The EPUB file itself is never touched.
//
// Note: locators (CFIs) are worked out from the trimmed page, and the story is always trimmed the
// same way, so a locator saved while reading a story always finds its place again in that story.

type AnchorLike = Node | Range

function nodeOf(anchor: AnchorLike): Node {
  // A Range from inside the book's frame is not an instance of this window's Range, so check by shape.
  if (!('startContainer' in anchor)) return anchor
  const { startContainer, startOffset } = anchor
  // A range that wraps an element starts at its parent, at the element's position.
  return startContainer.childNodes[startOffset] ?? startContainer
}

function removeAll(nodes: Node[]): void {
  for (const node of nodes) node.parentNode?.removeChild(node)
}

/** Removes everything before the anchor, keeping the anchor and everything after it. */
export function removeBefore(anchor: AnchorLike): void {
  let node: Node | null = nodeOf(anchor)
  const body = node.ownerDocument?.body
  while (node && node !== body) {
    const earlier: Node[] = []
    for (let s = node.previousSibling; s; s = s.previousSibling) earlier.push(s)
    removeAll(earlier)
    node = node.parentNode
  }
}

/** Removes the anchor and everything after it, keeping everything before. */
export function removeFrom(anchor: AnchorLike): void {
  const start = nodeOf(anchor)
  const body = start.ownerDocument?.body
  let node: Node | null = start
  while (node && node !== body) {
    const later: Node[] = []
    for (let s = node.nextSibling; s; s = s.nextSibling) later.push(s)
    removeAll(later)
    node = node.parentNode
  }
  start.parentNode?.removeChild(start)
}

/** Where a piece of text sits in a page: a text node and a character offset in it. */
export interface TextPosition {
  node: Text
  offset: number
}

/**
 * Finds the first place in the page where the text appears. Spaces in the text match any gap,
 * including the line breaks between paragraphs, so a marker can run across several elements.
 */
export function findText(doc: Document, text: string): TextPosition | null {
  const body = doc.body
  if (!body) return null
  const nodes: Text[] = []
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */)
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    nodes.push(n as Text)
  const all = nodes.map((n) => n.data).join('')
  const words = text.trim().split(/\s+/)
  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*')
  const match = new RegExp(pattern).exec(all)
  if (!match) return null
  let start = match.index
  for (const node of nodes) {
    if (start < node.data.length) return { node, offset: start }
    start -= node.data.length
  }
  return null
}

/** Removes the text from this position on, and everything after it. */
export function removeFromText({ node, offset }: TextPosition): void {
  node.data = node.data.slice(0, offset)
  const body = node.ownerDocument.body
  let current: Node | null = node
  while (current && current !== body) {
    const later: Node[] = []
    for (let s = current.nextSibling; s; s = s.nextSibling) later.push(s)
    removeAll(later)
    current = current.parentNode
  }
}

/** Removes everything before this position, keeping the text from it on. */
export function removeBeforeText({ node, offset }: TextPosition): void {
  node.data = node.data.slice(offset)
  const body = node.ownerDocument.body
  let current: Node | null = node
  while (current && current !== body) {
    const earlier: Node[] = []
    for (let s = current.previousSibling; s; s = s.previousSibling)
      earlier.push(s)
    removeAll(earlier)
    current = current.parentNode
  }
}

const PLACEHOLDER = /^\s*(?:[{[]\s*Illustration\b[^}\]]*[}\]]\s*)+$/i

/**
 * Removes the "{Illustration}" and "[Illustration: caption]" placeholder lines that Project
 * Gutenberg leaves where a picture was. Only a block that holds nothing but placeholders goes,
 * and never one with a real image in it.
 */
export function removeIllustrationPlaceholders(doc: Document): void {
  const body = doc.body
  if (!body) return
  const blocks = body.querySelectorAll('p, div, span, pre, li, blockquote')
  for (const block of Array.from(blocks)) {
    if (!block.isConnected) continue
    if (block.querySelector('img, svg, image')) continue
    if (block.querySelector('p, div, pre, li, blockquote')) continue
    if (PLACEHOLDER.test(block.textContent ?? '')) block.remove()
  }
}
