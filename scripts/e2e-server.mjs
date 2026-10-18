// The server for the Playwright tests: builds the app once, then serves it on port 4173.
// Playwright starts this (see playwright.config.ts) and stops it when the run ends.
//
// Safety rules:
//  - It only ever stops a server that THIS script started on an earlier run (it knows its own by
//    the pid file and by a header the server sends). Any other program on the port is left alone,
//    and the run stops with a message instead of reusing it.
//  - Port 5173 (the dev server) is only checked and reported; this script never starts or stops it.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4173
const DEV_PORT = 5173
const PID_FILE = path.join(ROOT, '.cache', 'e2e-server.pid')
const MARKER = 'x-dog-eared-tales-e2e'

/** What answers on a port: nothing, or its response headers. */
function probe(port) {
  return new Promise((resolve) => {
    const request = http.get(
      { host: 'localhost', port, path: '/', timeout: 1500 },
      (response) => {
        response.resume()
        resolve({ busy: true, headers: response.headers })
      },
    )
    request.on('timeout', () => {
      request.destroy()
      resolve({ busy: true, headers: {} })
    })
    request.on('error', (error) =>
      // Refused: nothing is listening. Anything else (a reset, a timeout) means something is.
      resolve({ busy: error.code !== 'ECONNREFUSED', headers: {} }),
    )
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function stopLeftover() {
  if (!existsSync(PID_FILE)) return
  const pid = Number(readFileSync(PID_FILE, 'utf8'))
  rmSync(PID_FILE, { force: true })
  const seen = await probe(PORT)
  if (seen.busy && seen.headers[MARKER] && Number.isInteger(pid) && pid > 0) {
    console.log(
      `e2e: stopping the server this script left running (pid ${pid})`,
    )
    try {
      process.kill(pid)
    } catch {
      /* already gone */
    }
    for (let i = 0; i < 20 && (await probe(PORT)).busy; i++) await sleep(250)
  }
}

await stopLeftover()

if ((await probe(PORT)).busy) {
  console.error(
    `e2e: port ${PORT} is in use by a program this script did not start, so it will not be reused.\n` +
      `Stop that program (or free the port) and run the tests again.`,
  )
  process.exit(1)
}
if ((await probe(DEV_PORT)).busy) {
  console.log(
    `e2e: note: something is listening on ${DEV_PORT} (a dev server). It is not used and not touched.`,
  )
}

// Build once: the catalog (skipped if nothing changed), then the app.
const catalog = spawnSync(process.execPath, ['scripts/build-catalog.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (catalog.status !== 0) process.exit(catalog.status ?? 1)
await build({ root: ROOT, logLevel: 'warn' })

const server = await preview({
  root: ROOT,
  logLevel: 'warn',
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  plugins: [
    {
      name: 'e2e-marker',
      configurePreviewServer(s) {
        s.middlewares.use((_request, response, next) => {
          response.setHeader(MARKER, '1')
          next()
        })
      },
    },
  ],
})
mkdirSync(path.dirname(PID_FILE), { recursive: true })
writeFileSync(PID_FILE, String(process.pid))
console.log(`e2e: serving dist on http://localhost:${PORT}`)

const stop = async () => {
  rmSync(PID_FILE, { force: true })
  await server.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('exit', () => rmSync(PID_FILE, { force: true }))
