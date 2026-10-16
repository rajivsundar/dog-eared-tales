import { Suspense, lazy, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { settingsStore } from '../stores'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { WithBottomNav } from './BottomNav'
import AllStoriesPage from './AllStoriesPage'
import HomePage from './HomePage'

// The reader (and the book engine behind it) loads only when someone opens a story.
const ReaderScreen = lazy(() => import('../features/reader/ReaderScreen'))
const LibraryScreen = lazy(() => import('../features/library/LibraryScreen'))

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
        <Route element={<WithBottomNav />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/all" element={<AllStoriesPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/read/:id" element={<ReaderScreen />} />
      </Routes>
    </Suspense>
  )
}
