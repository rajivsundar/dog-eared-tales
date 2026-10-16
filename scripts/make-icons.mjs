// Draws the app icons: a folded page corner on a book. Original art, made here from simple shapes.
// Run with `npm run icons` after changing the artwork. The PNGs in public/icons/ are committed.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

// Paths are relative to the project folder, wherever the script is started from.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NIGHT = '#1b1c1f'
const PAPER = '#fbf8f2'
const COVER = '#8a3b12'
const ACCENT = '#e3a86f'
const RULE = '#cdbf9f'

/** The book, drawn in a 512 x 512 box. */
const book = `
  <rect x="92" y="100" width="328" height="316" rx="22" fill="${COVER}"/>
  <path d="M112 120 H352 L400 168 V396 H112 Z" fill="${PAPER}"/>
  <path d="M352 120 L400 168 H352 Z" fill="${ACCENT}"/>
  <path d="M352 120 L400 168" stroke="${RULE}" stroke-width="3" fill="none"/>
  <line x1="256" y1="148" x2="256" y2="372" stroke="${RULE}" stroke-width="4"/>
  <g stroke="${RULE}" stroke-width="8" stroke-linecap="round">
    <line x1="146" y1="190" x2="226" y2="190"/>
    <line x1="146" y1="228" x2="226" y2="228"/>
    <line x1="146" y1="266" x2="226" y2="266"/>
    <line x1="146" y1="304" x2="206" y2="304"/>
    <line x1="286" y1="204" x2="326" y2="204"/>
    <line x1="286" y1="242" x2="366" y2="242"/>
    <line x1="286" y1="280" x2="366" y2="280"/>
    <line x1="286" y1="318" x2="346" y2="318"/>
  </g>`

/** A normal icon: rounded square. A maskable icon: full square, art inside the safe zone. */
function svg({ maskable }) {
  const art = maskable
    ? `<g transform="translate(256 256) scale(0.72) translate(-256 -246)">${book}</g>`
    : `<g transform="translate(256 256) scale(0.9) translate(-256 -258)">${book}</g>`
  const bg = maskable
    ? `<rect width="512" height="512" fill="${NIGHT}"/>`
    : `<rect width="512" height="512" rx="104" fill="${NIGHT}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${art}</svg>`
}

const outputs = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
]

mkdirSync(path.join(ROOT, 'public', 'icons'), { recursive: true })
writeFileSync(
  path.join(ROOT, 'public', 'favicon.svg'),
  svg({ maskable: false }),
)

const browser = await chromium.launch()
try {
  for (const { file, size, maskable } of outputs) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg({ maskable })}`,
    )
    await page.screenshot({ path: path.join(ROOT, file), omitBackground: true })
    await page.close()
    console.log(`wrote ${file}`)
  }
} finally {
  await browser.close()
}
