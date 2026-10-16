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
