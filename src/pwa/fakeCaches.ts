// An in-memory stand-in for the browser's Cache Storage, for tests only.

export function fakeCacheStorage(initial: Record<string, string[]> = {}) {
  const stores = new Map<string, Map<string, Response>>()
  for (const [name, urls] of Object.entries(initial)) {
    stores.set(
      name,
      new Map(
        urls.map((u) => [
          new URL(u, 'http://localhost').href,
          new Response('x'),
        ]),
      ),
    )
  }
  const storage = {
    open: async (name: string) => {
      const map = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, map)
      return {
        keys: async () => [...map.keys()].map((url) => ({ url }) as Request),
        put: async (request: RequestInfo | URL, response: Response) => {
          map.set(new URL(String(request), 'http://localhost').href, response)
        },
        match: async (request: RequestInfo | URL) =>
          map.get(new URL(String(request), 'http://localhost').href),
      }
    },
  } as unknown as CacheStorage
  return {
    storage,
    names: () => [...stores.keys()],
    paths: (name: string) =>
      [...(stores.get(name)?.keys() ?? [])].map((u) => new URL(u).pathname),
  }
}
