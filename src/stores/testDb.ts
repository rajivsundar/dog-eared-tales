import 'fake-indexeddb/auto'
import { TwiceToldDB } from './db'

/** A fresh, empty in-memory database for one test. */
let counter = 0
export function newTestDb(): TwiceToldDB {
  return new TwiceToldDB(`test-${counter++}`)
}
