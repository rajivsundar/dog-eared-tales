import { useEffect, useState } from 'react'
import { useInstallMode } from '../../pwa/install'
import { eventLog, settingsStore } from '../../stores'

/**
 * True once, on the end screen after the reader's first finished story, if the app can be
 * installed. It never shows when the app is already installed, and never a second time.
 */
export function useInstallOffer(finished: boolean): boolean {
  const mode = useInstallMode()
  const [offer, setOffer] = useState(false)

  useEffect(() => {
    if (!finished || mode === 'hidden') return
    let cancelled = false
    ;(async () => {
      const settings = await settingsStore.get()
      if (settings.installOffered) return
      const events = await eventLog.list()
      const finishedWorks = new Set(
        events.filter((e) => e.type === 'finished').map((e) => e.workId),
      )
      if (finishedWorks.size > 1) return
      await settingsStore.update({ installOffered: true })
      if (!cancelled) setOffer(true)
    })().catch((error: unknown) => console.debug(error))
    return () => {
      cancelled = true
    }
  }, [finished, mode])

  return offer && mode !== 'hidden'
}
