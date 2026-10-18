import { useEffect, useState } from 'react'
import { settingsStore } from '../../stores'

/** Settings → Seasonal themes: on or off, for this profile. Off means the usual look all year. */
export function SeasonalToggle() {
  const [on, setOn] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    settingsStore
      .get()
      .then((s) => {
        if (!cancelled) setOn(s.seasonalThemes !== false)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const change = (next: boolean): void => {
    setOn(next)
    setFailed(false)
    settingsStore.update({ seasonalThemes: next }).catch((error: unknown) => {
      console.error(error)
      setOn(!next)
      setFailed(true)
    })
  }

  return (
    <section aria-labelledby="seasonal-title" className="mt-10">
      <h2 id="seasonal-title" className="font-serif text-2xl font-bold">
        Seasonal themes
      </h2>
      <p className="mt-2 text-muted">
        Artwork, a seasonal row of stories and a seasonal welcome while a season
        is on, like fall. Turn them off to see the usual Dog-Eared Tales all
        year.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={on ?? true}
          disabled={on === null}
          onChange={(e) => change(e.target.checked)}
          className="size-6 accent-(--accent)"
        />
        <span className="font-semibold">Seasonal themes</span>
        <span className="text-muted">{on === false ? 'Off' : 'On'}</span>
      </label>
      {failed && (
        <p role="alert" className="mt-2 font-semibold">
          We couldn’t save that.
        </p>
      )}
    </section>
  )
}
