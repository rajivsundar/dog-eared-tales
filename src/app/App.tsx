import { Suspense, lazy } from 'react'
import { Link, Route, Routes } from 'react-router'
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

export default function App() {
  return (
    <Suspense fallback={<p className="p-6 text-center">Loading…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/read/:id" element={<ReaderScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
