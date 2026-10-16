import { ShortlistScreen } from '../features/shortlist/ShortlistScreen'

/** The home page: the name, the tagline and Your Shortlist. */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-gutter py-8 sm:py-12">
      <header>
        <h1 className="font-serif text-3xl font-bold sm:text-4xl">
          Twice Told
        </h1>
        <p className="mt-2 text-base text-muted sm:text-lg">
          Great free stories, picked for you. Start short. Fall for the
          classics.
        </p>
      </header>
      <ShortlistScreen />
    </main>
  )
}
