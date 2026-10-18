import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type CatalogEntry, loadCatalog } from '../catalog'

/**
 * The full list of every story at /all, kept for testing so each one can be opened in the reader.
 */
export default function AllStoriesPage() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-center text-4xl font-bold">Dog-Eared Tales</h1>
      <p className="mt-3 text-center text-lg text-muted">
        Free classics, picked for you. Start short. Fold down a corner when one
        gets you.
      </p>

      <section aria-labelledby="all-stories" className="mt-10">
        <h2 id="all-stories" className="text-lg font-semibold">
          All stories{' '}
          <span className="text-sm font-normal text-muted">(for testing)</span>
        </h2>
        {failed && <p role="alert">We couldn’t load the stories.</p>}
        {!entries && !failed && <p>Loading…</p>}
        {entries && (
          <ul className="mt-3 divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/read/${entry.id}`}
                  className="flex items-baseline justify-between gap-3 py-2 hover:bg-surface"
                >
                  <span>
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-gray-600"> · {entry.author}</span>
                    {entry.isCollection && (
                      <span className="text-sm text-muted">
                        {' '}
                        · from {entry.bookTitle.split(' / ')[0]}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {entry.readingMinutes} min
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
