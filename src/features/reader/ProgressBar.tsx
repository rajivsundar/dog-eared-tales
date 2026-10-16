import { minutesLeftLabel } from './labels'

export interface ProgressBarProps {
  /** 0 to 1 within the story. */
  fraction: number
  minutesLeft: number
}

/** A slim bar showing how far through this story the reader is, with the minutes left. */
export function ProgressBar({ fraction, minutesLeft }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
  return (
    <div className="flex w-full items-center gap-3">
      <div
        role="progressbar"
        aria-label="Progress through this story"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-testid="progress"
        className="h-1 flex-1 overflow-hidden rounded bg-current/20"
      >
        <div
          className="h-full rounded bg-current"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        data-testid="minutes-left"
        className="shrink-0 text-xs tabular-nums"
      >
        {minutesLeftLabel(minutesLeft)}
      </span>
    </div>
  )
}
