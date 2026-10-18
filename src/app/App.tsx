import { Fragment, Suspense, lazy, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { UpdateBanner } from '../pwa/UpdateBanner'
import { settingsStore } from '../stores'
import { useProfiles } from '../features/profiles/useProfiles'
import { useWhoGate } from '../features/profiles/useWhoGate'
import { FirstRunGate } from '../features/onboarding/FirstRunGate'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { WithBottomNav } from './BottomNav'
import AllStoriesPage from './AllStoriesPage'
import HomePage from './HomePage'

// The reader (and the book engine behind it) loads only when someone opens a story.
const ReaderScreen = lazy(() => import('../features/reader/ReaderScreen'))
const OnboardingScreen = lazy(
  () => import('../features/onboarding/OnboardingScreen'),
)
const TuneScreen = lazy(() => import('../features/onboarding/TuneScreen'))
const LibraryScreen = lazy(() => import('../features/library/LibraryScreen'))
const WhoScreen = lazy(() => import('../features/profiles/WhoScreen'))

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
function useSavedTheme(profileKey: number): void {
  const { pathname } = useLocation()
  useEffect(() => {
    settingsStore
      .get()
      .then((s) => {
        document.documentElement.dataset.theme = s.theme
      })
      .catch(() => {})
  }, [pathname, profileKey])
}

/** Shown if the reading profiles could not be opened. Nothing has been changed or lost. */
function StorageProblem() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">We couldn’t open your reading data</h1>
      <p className="mt-3">
        Nothing has been changed or lost. Close other Dog-Eared Tales tabs, then
        reload the page to try again.
      </p>
    </main>
  )
}

export default function App() {
  const snapshot = useProfiles()
  useSavedTheme(snapshot.epoch)
  useWhoGate(snapshot)
  if (snapshot.status === 'error') return <StorageProblem />
  if (snapshot.status === 'loading') {
    return <p className="p-6 text-center">Loading…</p>
  }
  return (
    <>
      <UpdateBanner />
      {/* Keyed by the open profile, so every screen starts fresh after a switch. */}
      <Fragment key={snapshot.epoch}>
        <Suspense fallback={<p className="p-6 text-center">Loading…</p>}>
          <Routes>
            <Route element={<WithBottomNav />}>
              <Route
                path="/"
                element={
                  <FirstRunGate>
                    <HomePage />
                  </FirstRunGate>
                }
              />
              <Route path="/library" element={<LibraryScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/all" element={<AllStoriesPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/who" element={<WhoScreen />} />
            <Route path="/welcome" element={<OnboardingScreen />} />
            <Route path="/tune" element={<TuneScreen />} />
            <Route path="/read/:id" element={<ReaderScreen />} />
          </Routes>
        </Suspense>
      </Fragment>
    </>
  )
}
