import { ShortlistScreen } from '../features/shortlist/ShortlistScreen'
import { useState } from 'react'
import { useSeason } from './useSeason'

/** The home page: the name, a line under it and Your Shortlist. */
export default function HomePage() {
  const [now] = useState(() => new Date())
  const { season, ready } = useSeason(now)
  return (
    <main className="mx-auto max-w-5xl px-gutter py-8 sm:py-12">
      <header>
        <h1 className="font-serif text-3xl font-bold sm:text-4xl">
          Twice Told
        </h1>
        <p className="mt-2 min-h-7 text-base text-muted sm:text-lg">
          {ready &&
            (season?.shortlistSubtitle ??
              'Great free stories, picked for you. Start short. Fall for the classics.')}
        </p>
      </header>
      <ShortlistScreen />
    </main>
  )
}
