import 'fake-indexeddb/auto'
import { TwiceToldDB } from './db'
import { createEventLog } from './eventLog'
import { createHighlightStore } from './highlightStore'
import { createLibraryStore } from './libraryStore'
import {
  type ProfileManagerOptions,
  createProfileManager,
} from './profileManager'
import { createProfileStore } from './profileStore'
import { createProgressStore } from './progressStore'
import { createSettingsStore } from './settingsStore'

/** A fresh, empty in-memory database for one test. */
let counter = 0
export function newTestDb(): TwiceToldDB {
  return new TwiceToldDB(`test-${counter++}`)
}

/** A set of database names no other test uses, so tests never see each other's profiles. */
export function testNames(): Required<
  Pick<
    ProfileManagerOptions,
    'registryName' | 'profilePrefix' | 'guestPrefix' | 'legacyName'
  >
> {
  const n = counter++
  return {
    registryName: `t${n}-registry`,
    profilePrefix: `t${n}-p-`,
    guestPrefix: `t${n}-guest-`,
    legacyName: `t${n}-legacy`,
  }
}

/** A tab's session storage, in memory. Pass the same one to a second manager to "reload". */
export function fakeSession(): Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

/** A profile manager over in-memory databases with names of its own. No locks, no other tabs. */
export function newTestManager(
  options: ProfileManagerOptions = {},
): ReturnType<typeof createProfileManager> {
  return createProfileManager({
    ...testNames(),
    session: fakeSession(),
    locks: null,
    channelName: null,
    ...options,
  })
}

/** Puts something in every store. `tag` makes the records different for each profile. */
export async function seedProfileData(
  target: TwiceToldDB,
  tag = 'a',
): Promise<void> {
  await createProfileStore(target).put({
    id: 'profile',
    tasteVector: [],
    facetBeliefs: { [`mood:${tag}`]: { success: 3, failure: 0 } },
    ladderLevel: 2,
    wordsPerMinute: 238,
    version: 2,
  })
  const log = createEventLog(target)
  await log.append({ workId: `${tag}-1`, type: 'finished', at: 100 })
  await log.append({ workId: `${tag}-1`, type: 'love', at: 200 })
  await log.append({
    workId: `${tag}-2`,
    type: 'notForMe',
    reason: 'too-long',
    at: 300,
  })
  await createLibraryStore(target).save(`${tag}-3`, {
    shelf: 'Weekend',
    addedAt: 50,
  })
  await createProgressStore(target).set({
    workId: `${tag}-2`,
    locator: 'epubcfi(/6/4)',
    percent: 40,
    secondsRead: 600,
  })
  await createHighlightStore(target).add({
    workId: `${tag}-1`,
    locator: 'epubcfi(/6/2)',
    color: 'yellow',
    note: `note ${tag}`,
  })
  await createSettingsStore(target).update({
    theme: 'night',
    textSize: 7,
    shortlist: {
      date: '2026-10-16',
      picks: [{ workId: `${tag}-1`, reason: 'r' }],
    },
    persistence: { requested: true, granted: true },
  })
}
