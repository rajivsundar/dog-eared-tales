import { describe, expect, it, vi } from 'vitest'
import { fakeCacheStorage } from './fakeCaches'
import {
  MIN_FREE_BYTES,
  TEXTS_CACHE,
  autoCacheTexts,
  cachedTextPaths,
  freeBytes,
  onTextCacheChange,
} from './textCache'

const MB = 1024 * 1024
const ok = () => new Response('book', { status: 200 })

function setup(
  options: {
    cached?: string[]
    free?: number | null
    online?: boolean
    respond?: (url: string) => Response | Promise<Response>
  } = {},
) {
  const fake = fakeCacheStorage(
    options.cached ? { [TEXTS_CACHE]: options.cached } : {},
  )
  const fetchFn = vi.fn(async (url: RequestInfo | URL) =>
    (options.respond ?? ok)(String(url)),
  )
  const estimate = vi.fn(async () => ({
    quota: (options.free ?? 500 * MB) + 100 * MB,
    usage: 100 * MB,
  }))
  const deps = {
    caches: fake.storage,
    fetch: fetchFn as unknown as typeof fetch,
    storage: options.free === null ? undefined : { estimate },
    isOnline: () => options.online ?? true,
  }
  return { fake, fetchFn, estimate, deps }
}

describe('auto-caching book texts', () => {
  it('fetches each file once and stores it in the texts cache', async () => {
    const { fake, fetchFn, deps } = setup()
    const result = await autoCacheTexts(
      ['/texts/pg-1.epub', '/texts/pg-2.epub'],
      deps,
    )
    expect(result).toEqual({
      status: 'ok',
      cached: ['/texts/pg-1.epub', '/texts/pg-2.epub'],
      failed: [],
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fake.paths(TEXTS_CACHE)).toEqual([
      '/texts/pg-1.epub',
      '/texts/pg-2.epub',
    ])
  })

  it('fetches a file shared by several works only once', async () => {
    const { fetchFn, deps } = setup()
    await autoCacheTexts(
      ['/texts/pg-1661.epub', '/texts/pg-1661.epub', '/texts/pg-1661.epub'],
      deps,
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('does not fetch what is already stored', async () => {
    const { fetchFn, deps } = setup({ cached: ['/texts/pg-1.epub'] })
    const result = await autoCacheTexts(
      ['/texts/pg-1.epub', '/texts/pg-2.epub'],
      deps,
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.cached).toEqual(['/texts/pg-2.epub'])
  })

  it('does nothing at all when everything is stored', async () => {
    const { fetchFn, estimate, deps } = setup({ cached: ['/texts/pg-1.epub'] })
    const result = await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(result.status).toBe('ok')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(estimate).not.toHaveBeenCalled()
  })

  it('skips everything when less than 50 MB is free', async () => {
    const { fake, fetchFn, deps } = setup({ free: MIN_FREE_BYTES - 1 })
    const result = await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(result.status).toBe('low-space')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(fake.paths(TEXTS_CACHE)).toEqual([])
  })

  it('goes ahead with exactly 50 MB free', async () => {
    const { fetchFn, deps } = setup({ free: MIN_FREE_BYTES })
    expect((await autoCacheTexts(['/texts/pg-1.epub'], deps)).status).toBe('ok')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('checks the free space before caching', async () => {
    const { estimate, fetchFn, deps } = setup()
    const order: string[] = []
    estimate.mockImplementation(async () => {
      order.push('estimate')
      return { quota: 1000 * MB, usage: 0 }
    })
    fetchFn.mockImplementation(async () => {
      order.push('fetch')
      return ok()
    })
    await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(order).toEqual(['estimate', 'fetch'])
  })

  it('goes ahead if the browser cannot say how much is free', async () => {
    const { fetchFn, deps } = setup({ free: null })
    await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('does nothing while offline', async () => {
    const { fetchFn, deps } = setup({ online: false })
    const result = await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(result.status).toBe('offline')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('does nothing when the browser has no Cache Storage', async () => {
    const { deps } = setup()
    // jsdom has no Cache Storage, so leaving it out means "not supported".
    const result = await autoCacheTexts(['/texts/pg-1.epub'], {
      ...deps,
      caches: undefined,
    })
    expect(result.status).toBe('unsupported')
  })

  it('stores only complete, successful responses', async () => {
    const { fake, deps } = setup({
      respond: (url) =>
        url.includes('missing')
          ? new Response('nope', { status: 404 })
          : url.includes('partial')
            ? new Response('part', { status: 206 })
            : ok(),
    })
    const result = await autoCacheTexts(
      ['/texts/missing.epub', '/texts/partial.epub', '/texts/good.epub'],
      deps,
    )
    expect(result.cached).toEqual(['/texts/good.epub'])
    expect(result.failed).toEqual([
      '/texts/missing.epub',
      '/texts/partial.epub',
    ])
    expect(fake.paths(TEXTS_CACHE)).toEqual(['/texts/good.epub'])
  })

  it('never throws, and keeps going after a failed fetch', async () => {
    const { fake, deps } = setup({
      respond: (url) => {
        if (url.includes('bad')) throw new Error('network down')
        return ok()
      },
    })
    const result = await autoCacheTexts(
      ['/texts/bad.epub', '/texts/good.epub'],
      deps,
    )
    expect(result.failed).toEqual(['/texts/bad.epub'])
    expect(fake.paths(TEXTS_CACHE)).toEqual(['/texts/good.epub'])
  })

  it('stops when the connection drops part-way', async () => {
    let online = true
    const { fetchFn, deps } = setup({
      respond: () => {
        online = false
        return ok()
      },
    })
    const result = await autoCacheTexts(
      ['/texts/a.epub', '/texts/b.epub', '/texts/c.epub'],
      { ...deps, isOnline: () => online },
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('offline')
  })

  it('does not fetch a file twice when two runs overlap', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { fetchFn, deps } = setup({
      respond: async () => {
        await gate
        return ok()
      },
    })
    const first = autoCacheTexts(['/texts/pg-9.epub'], deps)
    await new Promise((r) => setTimeout(r, 5))
    const second = autoCacheTexts(['/texts/pg-9.epub'], deps)
    release()
    await Promise.all([first, second])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('tells listeners when files were added', async () => {
    const { deps } = setup()
    const listener = vi.fn()
    const stop = onTextCacheChange(listener)
    await autoCacheTexts(['/texts/pg-1.epub'], deps)
    expect(listener).toHaveBeenCalledTimes(1)
    await autoCacheTexts(['/texts/pg-1.epub'], deps) // nothing new
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('what is stored', () => {
  it('lists the stored books by path', async () => {
    const { fake } = setup({
      cached: ['/texts/pg-1.epub', '/texts/pg-2.epub'],
    })
    expect(await cachedTextPaths(fake.storage)).toEqual(
      new Set(['/texts/pg-1.epub', '/texts/pg-2.epub']),
    )
    expect(await cachedTextPaths(undefined)).toEqual(new Set())
  })

  it('works out the free space from the browser estimate', async () => {
    expect(
      await freeBytes({ estimate: async () => ({ quota: 300, usage: 100 }) }),
    ).toBe(200)
    expect(await freeBytes(undefined)).toBeUndefined()
    expect(await freeBytes({ estimate: async () => ({}) })).toBeUndefined()
  })
})
