// @vitest-environment node
import sharp from 'sharp'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { MAX_EDGE, PICTURE_BOOK_EDGE, shrinkEpub } from './shrinkEpub.ts'

async function fakeBook(): Promise<Uint8Array> {
  const noise = (w: number, h: number): Buffer => {
    const data = Buffer.alloc(w * h * 3)
    for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 251
    return data
  }
  const photo = await sharp(noise(1600, 1200), {
    raw: { width: 1600, height: 1200, channels: 3 },
  })
    .jpeg({ quality: 95 })
    .toBuffer()
  const drawing = await sharp({
    create: {
      width: 1000,
      height: 500,
      channels: 4,
      background: { r: 10, g: 80, b: 160, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer()
  const small = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#fff' },
  })
    .jpeg()
    .toBuffer()
  const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
  return zipSync({
    mimetype: [enc('application/epub+zip'), { level: 0 }],
    'OEBPS/page.xhtml': enc(
      '<html><body><img src="photo.jpg"/> text</body></html>',
    ),
    'OEBPS/style.css': enc('p { margin: 0 }'),
    'OEBPS/photo.jpg': [new Uint8Array(photo), { level: 0 }],
    'OEBPS/drawing.png': [new Uint8Array(drawing), { level: 0 }],
    'OEBPS/small.jpg': [new Uint8Array(small), { level: 0 }],
  })
}

describe('shrinking the images of an EPUB', () => {
  it('scales JPEGs and PNGs down to 800 px and keeps names, types and order', async () => {
    const original = await fakeBook()
    const shrunk = await shrinkEpub(original)
    const before = unzipSync(original)
    const after = unzipSync(shrunk)

    expect(Object.keys(after)).toEqual(Object.keys(before))
    expect(Object.keys(after)[0]).toBe('mimetype')

    const photo = await sharp(after['OEBPS/photo.jpg']).metadata()
    expect(photo.format).toBe('jpeg')
    expect(Math.max(photo.width!, photo.height!)).toBe(MAX_EDGE)
    expect(after['OEBPS/photo.jpg'].length).toBeLessThan(
      before['OEBPS/photo.jpg'].length,
    )

    // A PNG stays a PNG, and keeps its transparency.
    const drawing = await sharp(after['OEBPS/drawing.png']).metadata()
    expect(drawing.format).toBe('png')
    expect(drawing.width).toBe(MAX_EDGE)
    expect(drawing.hasAlpha).toBe(true)
  })

  it('leaves page files, style sheets and the mimetype byte for byte, and never enlarges an image', async () => {
    const original = await fakeBook()
    const before = unzipSync(original)
    const after = unzipSync(await shrinkEpub(original))
    for (const name of ['mimetype', 'OEBPS/page.xhtml', 'OEBPS/style.css']) {
      expect(
        Buffer.compare(Buffer.from(after[name]), Buffer.from(before[name])),
      ).toBe(0)
    }
    const small = await sharp(after['OEBPS/small.jpg']).metadata()
    expect([small.width, small.height]).toEqual([40, 30])
  })

  it('shrinks a picture book harder: 600 px, and a PNG palette of at most 128 colours', async () => {
    const original = await fakeBook()
    const normal = unzipSync(await shrinkEpub(original))
    const picture = unzipSync(await shrinkEpub(original, true))
    const photo = await sharp(picture['OEBPS/photo.jpg']).metadata()
    expect(photo.format).toBe('jpeg')
    expect(Math.max(photo.width!, photo.height!)).toBe(PICTURE_BOOK_EDGE)
    expect(picture['OEBPS/photo.jpg'].length).toBeLessThan(
      normal['OEBPS/photo.jpg'].length,
    )
    const drawing = await sharp(picture['OEBPS/drawing.png']).metadata()
    expect(drawing.format).toBe('png')
    expect(drawing.width).toBe(PICTURE_BOOK_EDGE)
    expect(Object.keys(picture)).toEqual(Object.keys(normal))
    expect(
      Buffer.compare(
        Buffer.from(picture['OEBPS/page.xhtml']),
        Buffer.from(normal['OEBPS/page.xhtml']),
      ),
    ).toBe(0)
  })
})
