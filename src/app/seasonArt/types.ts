import type { ComponentType } from 'react'

/** The drawings a season provides. */
export interface SeasonArt {
  /** An illustration for the welcome page, placed with the cover fan. */
  Scene: ComponentType
  /** Gentle animated decoration over the welcome page. */
  Leaves: ComponentType
  /** A small mark beside the Your Shortlist heading. */
  Accent: ComponentType
}
