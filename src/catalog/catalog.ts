import type { CatalogEntry } from './types'

const CATALOG_URL = '/catalog/catalog.json'

let cached: Promise<CatalogEntry[]> | null = null

/** Loads the catalog once and keeps it. Throws a clear error if it cannot be read. */
export function loadCatalog(): Promise<CatalogEntry[]> {
  cached ??= fetch(CATALOG_URL)
    .then((response) => {
      if (!response.ok)
        throw new Error(`could not load the catalog (${response.status})`)
      return response.json() as Promise<{ entries?: CatalogEntry[] }>
    })
    .then((file) => {
      if (!Array.isArray(file.entries))
        throw new Error('the catalog file has no entries')
      return file.entries
    })
    .catch((error: unknown) => {
      cached = null // let a later call try again
      throw error
    })
  return cached
}

export async function getEntry(id: string): Promise<CatalogEntry | undefined> {
  return (await loadCatalog()).find((entry) => entry.id === id)
}

/** For tests: forget the loaded catalog. */
export function resetCatalogCache(): void {
  cached = null
}
