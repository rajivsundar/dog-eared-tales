// Makes the copy of an EPUB that the app publishes: every JPEG and PNG is scaled down to at most
// 800 px on its long edge and recompressed. Names, media types and every other file (page files,
// style sheets, the package file) are kept byte for byte, so reading positions stay valid.
// The original in content/raw is never touched.
import sharp from 'sharp'
import { unzipSync, zipSync } from 'fflate'

/** The longest side of a published image, in pixels. Smaller images are never enlarged. */
export const MAX_EDGE = 800
export const JPEG_QUALITY = 70
/** Change this when the rules above change, so cached results are made again. */
export const SHRINK_VERSION = 1

const JPEG = /\.jpe?g$/i
const PNG = /\.png$/i

async function shrinkImage(
  name: string,
  data: Uint8Array,
): Promise<Uint8Array> {
  const isJpeg = JPEG.test(name)
  if (!isJpeg && !PNG.test(name)) return data
  try {
    let image = sharp(data).resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    image = isJpeg
      ? image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      : image.png({ compressionLevel: 9, palette: true, quality: 80 })
    const out = await image.toBuffer()
    return out.length < data.length ? new Uint8Array(out) : data
  } catch {
    // An image sharp cannot read stays as it is.
    return data
  }
}

export async function shrinkEpub(epub: Uint8Array): Promise<Uint8Array> {
  const files = unzipSync(epub)
  const out: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  // Insertion order is the original order, so "mimetype" stays first.
  for (const [name, data] of Object.entries(files)) {
    const shrunk = await shrinkImage(name, data)
    // The mimetype file and images are stored as they are; the rest is deflated.
    const stored = name === 'mimetype' || JPEG.test(name) || PNG.test(name)
    out[name] = [shrunk, { level: stored ? 0 : 6 }]
  }
  return zipSync(out, { mtime: new Date(1980, 0, 1) })
}
