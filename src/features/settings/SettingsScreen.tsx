import { useEffect, useState } from 'react'
import { loadCatalog } from '../../catalog'
import { WEIGHT_MAX, buildProfile, topFacets } from '../../engine/recommend'
import { eventLog, profileStore } from '../../stores'
import type { Profile } from '../../stores'

type Beliefs = Profile['facetBeliefs']

function TasteList({
  title,
  items,
}: {
  title: string
  items: { name: string; weight: number }[]
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 capitalize">{item.name}</span>
              <span
                aria-hidden="true"
                className="h-2 flex-1 overflow-hidden rounded bg-line"
              >
                <span
                  className="block h-full rounded bg-accent"
                  style={{ width: `${(item.weight / WEIGHT_MAX) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Settings. For now: Your taste, with a Reset button. */
export function SettingsScreen() {
  const [beliefs, setBeliefs] = useState<Beliefs | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCatalog(), eventLog.list()])
      .then(([catalog, events]) => {
        if (!cancelled)
          setBeliefs(buildProfile(catalog, events, Date.now()).facetBeliefs)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const reset = (): void => {
    setConfirming(false)
    // The event log is never edited. A reset marker tells the learning to ignore what came before.
    eventLog
      .append({ workId: 'taste', type: 'reset' })
      .then(() => profileStore.clear())
      .then(() => setVersion((v) => v + 1))
      .catch((error: unknown) => {
        console.error(error)
        setFailed(true)
      })
  }

  const moods = beliefs ? topFacets(beliefs, 'mood') : []
  const genres = beliefs ? topFacets(beliefs, 'genre') : []

  return (
    <main className="mx-auto max-w-xl px-gutter py-8 sm:py-12">
      <h1 className="font-serif text-3xl font-bold">Settings</h1>

      <section aria-labelledby="taste-title" className="mt-8">
        <h2 id="taste-title" className="font-serif text-2xl font-bold">
          Your taste
        </h2>
        <p className="mt-2 text-muted">
          What you seem to like, learned from the stories you finish, rate,
          dog-ear or skip. It stays on this device.
        </p>
        {failed && (
          <p role="alert" className="mt-3">
            We couldn’t load your taste.
          </p>
        )}
        {!beliefs && !failed && <p className="mt-3 text-muted">Loading…</p>}
        {beliefs && (
          <div className="mt-4 flex flex-col gap-5">
            <TasteList title="Top moods" items={moods} />
            <TasteList title="Top genres" items={genres} />
          </div>
        )}

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Reset
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-label="Reset your taste"
            className="mt-6 rounded-card border border-line bg-surface p-4"
          >
            <p>
              Forget everything learned so far? Your Dog-eared stories and
              reading progress stay as they are.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-full border border-line px-5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-10 text-sm text-muted">
        More settings are coming. For now, change the font, text size and theme
        with the Aa button while you read.
      </p>
    </main>
  )
}
