import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type CatalogEntry, loadCatalog } from '../catalog'

/**
 * Temporary home page: the title, the tagline, and a plain list of every story so each one can
 * be opened in the reader. Your Shortlist replaces the list later.
 */
export default function HomePage() {
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
      <h1 className="text-center text-4xl font-bold">Twice Told</h1>
      <p className="mt-3 text-center text-lg text-gray-600">
        Great free stories, picked for you. Start short. Fall for the classics.
      </p>

      <section aria-labelledby="all-stories" className="mt-10">
        <h2 id="all-stories" className="text-lg font-semibold">
          All stories{' '}
          <span className="text-sm font-normal text-gray-500">
            (temporary list)
          </span>
        </h2>
        {failed && <p role="alert">We couldn’t load the stories.</p>}
        {!entries && !failed && <p>Loading…</p>}
        {entries && (
          <ul className="mt-3 divide-y divide-gray-200">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/read/${entry.id}`}
                  className="flex items-baseline justify-between gap-3 py-2 hover:bg-gray-50"
                >
                  <span>
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-gray-600"> · {entry.author}</span>
                    {entry.isCollection && (
                      <span className="text-sm text-gray-500">
                        {' '}
                        · from {entry.bookTitle.split(' / ')[0]}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
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
