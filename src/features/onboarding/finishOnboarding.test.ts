import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../../catalog'
import { netWeight } from '../../engine/recommend'
import { fakeCatalog, fakeStores } from '../shortlist/fakeStores'
import {
  loadShortlist,
  localDay,
  removePick,
} from '../shortlist/dailyShortlist'
import {
  finishOnboarding,
  hasAnsweredCards,
  isFirstRun,
  pickedMoods,
  startWithStory,
  tuneTaste,
} from './finishOnboarding'
import { ladderFor } from './moods'

const catalog = fakeCatalog() as unknown as CatalogEntry[]
const TODAY = new Date(2026, 9, 16, 9, 0)
const TOMORROW = new Date(2026, 9, 17, 9, 0)

function setup(entries = catalog) {
  const s = fakeStores()
  const deps = {
    catalog: entries,
    events: s.eventLog,
    profile: s.profileStore,
    settings: s.settingsStore,
    progress: s.progressStore,
  }
  return { s, deps }
}
const ids = (picks: { entry: CatalogEntry }[]) => picks.map((p) => p.entry.id)
const onboardEvents = (s: ReturnType<typeof fakeStores>) =>
  s.events.filter((e) => e.type === 'onboard')

describe('first run', () => {
  it('is true only with no profile and no events', async () => {
    const { s, deps } = setup()
    expect(await isFirstRun(deps)).toBe(true)
    await s.eventLog.append({ workId: 'story-1', type: 'open' })
    expect(await isFirstRun(deps)).toBe(false)
  })

  it('is false once a profile exists', async () => {
    const { s, deps } = setup()
    await s.profileStore.put({
      id: 'profile',
      tasteVector: [],
      facetBeliefs: {},
      ladderLevel: 0,
      wordsPerMinute: 238,
      version: 2,
    })
    expect(await isFirstRun(deps)).toBe(false)
  })

  it('is false straight after onboarding, even a skipped one', async () => {
    const { deps } = setup()
    await finishOnboarding(deps, { moods: [], cards: {} }, TODAY)
    expect(await isFirstRun(deps)).toBe(false)
  })
})

describe('finishing onboarding', () => {
  it('records the start, the moods and the card answers as events, in order', async () => {
    const { s, deps } = setup()
    await finishOnboarding(
      deps,
      {
        moods: ['eerie', 'cozy'],
        cards: { 'story-1': 'love', 'story-2': 'notForMe' },
      },
      TODAY,
    )
    expect(onboardEvents(s).map((e) => [e.workId, e.reason])).toEqual([
      ['onboarding', 'start'],
      ['onboarding', 'mood:eerie'],
      ['onboarding', 'mood:cozy'],
      ['story-1', 'love'],
      ['story-2', 'notForMe'],
    ])
    const times = onboardEvents(s).map((e) => e.at)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('builds the profile from those events, with the starting length preference', async () => {
    const { s, deps } = setup()
    await finishOnboarding(
      deps,
      { moods: ['eerie', 'tense'], cards: {}, ladderLevel: 2 },
      TODAY,
    )
    const profile = (await s.profileStore.get())!
    expect(netWeight(profile.facetBeliefs, 'mood:eerie')).toBeCloseTo(1, 2)
    expect(netWeight(profile.facetBeliefs, 'mood:tense')).toBeCloseTo(1, 2)
    expect(profile.ladderLevel).toBe(2)
  })

  it("stores today's first shortlist with 6 picks", async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    const saved = (await s.settingsStore.get()).shortlist!
    expect(saved.date).toBe(localDay(TODAY))
    expect(saved.picks).toHaveLength(6)
    // Opening the shortlist the same day shows exactly this list.
    expect(ids(await loadShortlist(deps, TODAY))).toEqual(
      saved.picks.map((p) => p.workId),
    )
  })

  it('Skip setup records only the start and leaves the starter mix', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: [], cards: {} }, TODAY)
    expect(onboardEvents(s)).toHaveLength(1)
    const profile = (await s.profileStore.get())!
    expect(profile.facetBeliefs).toEqual({})
    const saved = (await s.settingsStore.get()).shortlist!
    expect(saved.picks).toHaveLength(6)
    expect(
      saved.picks.every((p) => p.reason.startsWith('A good place to start')),
    ).toBe(true)
  })
})

describe('taste cards answered Not for me', () => {
  it('keep the work off the first shortlist and its replacements today', async () => {
    const { s, deps } = setup()
    // First find which work would lead the list, then say Not for me to it.
    const probe = setup()
    await finishOnboarding(
      probe.deps,
      { moods: ['eerie', 'cozy'], cards: {} },
      TODAY,
    )
    const lead = (await probe.s.settingsStore.get()).shortlist!.picks[0].workId

    await finishOnboarding(
      deps,
      { moods: ['eerie', 'cozy'], cards: { [lead]: 'notForMe' } },
      TODAY,
    )
    const saved = (await s.settingsStore.get()).shortlist!
    expect(saved.picks.map((p) => p.workId)).not.toContain(lead)
    expect(saved.avoid).toEqual([lead])

    // A replacement later today does not bring it back either.
    const picks = await loadShortlist(deps, TODAY)
    for (const gone of ids(picks).slice(0, 4)) {
      const { picks: next } = await removePick(deps, picks, gone, TODAY)
      expect(ids(next)).not.toContain(lead)
    }
  })

  it('are eligible again from the next day', async () => {
    // Six works: with one avoided, today has 5 picks; tomorrow all six are available.
    const six = catalog.slice(0, 6)
    const { s, deps } = setup(six)
    await finishOnboarding(
      deps,
      { moods: ['eerie', 'cozy'], cards: { 'story-3': 'notForMe' } },
      TODAY,
    )
    const today = (await s.settingsStore.get()).shortlist!
    expect(today.picks.map((p) => p.workId)).not.toContain('story-3')
    expect(today.picks).toHaveLength(5)

    const tomorrow = await loadShortlist(deps, TOMORROW)
    expect(ids(tomorrow)).toContain('story-3')
    expect((await s.settingsStore.get()).shortlist?.avoid).toBeUndefined()
  })

  it('are only a weak signal: -1.5 on the work, not a Not for me event', async () => {
    const { s, deps } = setup()
    await finishOnboarding(
      deps,
      { moods: [], cards: { 'story-2': 'notForMe' } },
      TODAY,
    )
    expect(s.events.some((e) => e.type === 'notForMe')).toBe(false)
    const profile = (await s.profileStore.get())!
    expect(netWeight(profile.facetBeliefs, 'mood:funny')).toBeCloseTo(-1.5, 2)
  })
})

describe('taste cards answered Love', () => {
  it('put at least one Loved card on the first shortlist', async () => {
    for (const loved of ['story-9', 'story-8', 'story-7']) {
      const fresh = setup()
      await finishOnboarding(
        fresh.deps,
        { moods: ['eerie', 'cozy'], cards: { [loved]: 'love' } },
        TODAY,
      )
      const saved = (await fresh.s.settingsStore.get()).shortlist!
      expect(
        saved.picks.map((p) => p.workId),
        loved,
      ).toContain(loved)
      expect(saved.picks).toHaveLength(6)
    }
  })

  it('does nothing special when no card was Loved', async () => {
    const { s, deps } = setup()
    await finishOnboarding(
      deps,
      { moods: ['eerie', 'cozy'], cards: { 'story-9': 'maybe' } },
      TODAY,
    )
    const saved = (await s.settingsStore.get()).shortlist!
    expect(saved.picks).toHaveLength(6)
  })
})

describe('redoing onboarding', () => {
  it('keeps all reading history and counts only the newest answers', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    await s.eventLog.append({ workId: 'story-4', type: 'finished' })
    await s.eventLog.append({ workId: 'story-4', type: 'love' })
    await s.libraryStore.save('story-5')
    const before = s.events.length

    await finishOnboarding(
      deps,
      { moods: ['romantic', 'funny'], cards: {} },
      TOMORROW,
    )

    // Nothing was deleted: the old events are all still there, and new ones were added.
    expect(s.events.length).toBe(before + 3)
    expect(
      s.events.some((e) => e.type === 'finished' && e.workId === 'story-4'),
    ).toBe(true)
    expect(s.library.has('story-5')).toBe(true)
    const profile = (await s.profileStore.get())!
    expect(netWeight(profile.facetBeliefs, 'mood:romantic')).toBeGreaterThan(0)
    // The first run's picks (eerie, cozy) no longer count. Real reading (story-4 is tense) still does.
    expect(netWeight(profile.facetBeliefs, 'mood:eerie')).toBe(0)
    expect(netWeight(profile.facetBeliefs, 'mood:cozy')).toBe(0)
    expect(netWeight(profile.facetBeliefs, 'mood:tense')).toBeGreaterThan(2)
  })
})

describe('reading context', () => {
  it('sets the starting length from the times picked', () => {
    expect(ladderFor([])).toBeUndefined()
    expect(ladderFor(['commute'])).toBe(0)
    expect(ladderFor(['lunch'])).toBe(1)
    expect(ladderFor(['evenings'])).toBe(2)
    expect(ladderFor(['weekends'])).toBe(3)
    expect(ladderFor(['commute', 'weekends'])).toBe(2)
    expect(ladderFor(['commute', 'lunch', 'evenings'])).toBe(1)
  })
})

describe('"Read a short story now" (startWithStory)', () => {
  it('saves an empty profile and nothing else, so the welcome never shows again', async () => {
    const { s, deps } = setup()
    expect(await isFirstRun(deps)).toBe(true)
    await startWithStory(deps)
    const profile = (await s.profileStore.get())!
    expect(profile.facetBeliefs).toEqual({})
    expect(s.events).toHaveLength(0)
    expect(await isFirstRun(deps)).toBe(false)
  })

  it('does not overwrite a profile that is already there', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    const before = await s.profileStore.get()
    await startWithStory(deps)
    expect(await s.profileStore.get()).toEqual(before)
  })

  it('the first rating after the story seeds the profile, and the next shortlist reflects it', async () => {
    const { s, deps } = setup()
    await startWithStory(deps)
    await s.eventLog.append({
      workId: 'story-1',
      type: 'finished',
      at: TODAY.getTime() - 1000,
    })
    await s.eventLog.append({
      workId: 'story-1',
      type: 'love',
      at: TODAY.getTime() - 500,
    })
    const picks = await loadShortlist(deps, TODAY)
    expect(picks).toHaveLength(6)
    const profile = (await s.profileStore.get())!
    expect(netWeight(profile.facetBeliefs, 'mood:eerie')).toBeGreaterThan(2)
    // The story just read is not offered again.
    expect(ids(picks)).not.toContain('story-1')
  })
})

describe('"Tune your picks" (tuneTaste)', () => {
  it('saves the card answers without a new start marker, so earlier mood picks still count', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    await tuneTaste(deps, { 'story-2': 'love', 'story-3': 'maybe' }, TODAY)
    const reasons = onboardEvents(s).map((e) => e.reason)
    expect(reasons).toEqual([
      'start',
      'mood:eerie',
      'mood:cozy',
      'love',
      'maybe',
    ])
    expect(reasons.filter((r) => r === 'start')).toHaveLength(1)
    const profile = (await s.profileStore.get())!
    // eerie: +1 for the pick, still there. funny (story-2): +1.5 from the Love card.
    expect(netWeight(profile.facetBeliefs, 'mood:eerie')).toBeCloseTo(1, 2)
    expect(netWeight(profile.facetBeliefs, 'mood:funny')).toBeCloseTo(1.5, 2)
  })

  it('works after "Read a short story now", where there was no start marker', async () => {
    const { s, deps } = setup()
    await startWithStory(deps)
    await tuneTaste(deps, { 'story-2': 'love' }, TODAY)
    expect(onboardEvents(s).map((e) => e.reason)).toEqual(['love'])
    expect(
      netWeight((await s.profileStore.get())!.facetBeliefs, 'mood:funny'),
    ).toBeCloseTo(1.5, 2)
  })

  it('rebuilds today’s shortlist at once', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    const before = (await s.settingsStore.get()).shortlist!.picks.map(
      (p) => p.workId,
    )
    // Love a story that is not on the list.
    const outsider = catalog.find((e) => !before.includes(e.id))!
    await tuneTaste(deps, { [outsider.id]: 'love' }, TODAY)
    const after = (await s.settingsStore.get()).shortlist!
    expect(after.date).toBe(localDay(TODAY))
    expect(after.picks).toHaveLength(6)
    expect(after.picks.map((p) => p.workId)).not.toEqual(before)
  })

  it('keeps the first-shortlist rules: skips Not for me cards today and holds a Loved one', async () => {
    const { s, deps } = setup()
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    const lead = (await s.settingsStore.get()).shortlist!.picks[0].workId
    const first = (await s.settingsStore.get()).shortlist!.picks.map(
      (p) => p.workId,
    )
    const loved = catalog.find(
      (e) => !first.includes(e.id) && e.id !== lead,
    )!.id
    await tuneTaste(deps, { [lead]: 'notForMe', [loved]: 'love' }, TODAY)
    const saved = (await s.settingsStore.get()).shortlist!
    const list = saved.picks.map((p) => p.workId)
    expect(list).not.toContain(lead)
    expect(list).toContain(loved)
    expect(saved.avoid).toEqual([lead])
    // Not for me on a card is only a weak signal: it is not a Not for me event.
    expect(s.events.some((e) => e.type === 'notForMe')).toBe(false)
  })

  it('reports which moods were picked and whether any card was answered', async () => {
    const { s, deps } = setup()
    expect(pickedMoods([])).toEqual([])
    await finishOnboarding(deps, { moods: ['eerie', 'cozy'], cards: {} }, TODAY)
    expect(pickedMoods(await s.eventLog.list())).toEqual(['eerie', 'cozy'])
    expect(hasAnsweredCards(await s.eventLog.list())).toBe(false)
    await tuneTaste(deps, { 'story-2': 'maybe' }, TODAY)
    expect(hasAnsweredCards(await s.eventLog.list())).toBe(true)
  })
})
