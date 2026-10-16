import type { TwiceToldDB } from './db'
import type { ProfileStore } from './types'

export function createProfileStore(db: TwiceToldDB): ProfileStore {
  return {
    get: () => db.profile.get('profile'),
    async put(profile) {
      await db.profile.put({ ...profile, id: 'profile' })
    },
    async clear() {
      await db.profile.clear()
    },
  }
}
