import { Suspense, lazy, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { settingsStore } from '../stores'
import AllStoriesPage from './AllStoriesPage'
import HomePage from './HomePage'

// The reader (and the book engine behind it) loads only when someone opens a story.
const ReaderScreen = lazy(() => import('../features/reader/ReaderScreen'))

function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-3">
        <Link to="/" className="underline">
          Back to the home page
        </Link>
      </p>
    </main>
  )
}

/** Puts the reader's saved theme on the page, so the home page uses the same colours as the reader. */
function useSavedTheme(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    settingsStore
      .get()
      .then((s) => {
        document.documentElement.dataset.theme = s.theme
      })
      .catch(() => {})
  }, [pathname])
}

export default function App() {
  useSavedTheme()
  return (
    <Suspense fallback={<p className="p-6 text-center">Loading…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/all" element={<AllStoriesPage />} />
        <Route path="/read/:id" element={<ReaderScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
