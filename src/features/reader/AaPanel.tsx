import { THEME_COLORS } from '../../engine/reader'
import type { ReaderStyle } from '../../engine/reader'

const FONTS: { value: ReaderStyle['font']; label: string }[] = [
  { value: 'literata', label: 'Literata' },
  { value: 'atkinson', label: 'Atkinson Hyperlegible' },
  { value: 'opendyslexic', label: 'OpenDyslexic' },
  { value: 'systemSerif', label: 'System serif' },
]

const THEMES: { value: ReaderStyle['theme']; label: string }[] = [
  { value: 'system', label: 'Match device' },
  { value: 'paper', label: 'Paper' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'night', label: 'Night' },
  { value: 'black', label: 'Black' },
]

function swatch(theme: ReaderStyle['theme']): string {
  if (theme === 'system') {
    return `linear-gradient(90deg, ${THEME_COLORS.paper.background} 50%, ${THEME_COLORS.night.background} 50%)`
  }
  return THEME_COLORS[theme].background
}

export interface AaPanelProps {
  style: ReaderStyle
  onChange: (change: Partial<ReaderStyle>) => void
  onClose: () => void
}

/** Font, text size and theme. Each change is applied as soon as it is made. */
export function AaPanel({ style, onChange, onClose }: AaPanelProps) {
  const setSize = (step: number): void =>
    onChange({ sizeStep: Math.min(10, Math.max(1, step)) })
  return (
    <div
      role="dialog"
      aria-label="Text and theme settings"
      className="absolute inset-x-0 bottom-10 z-30 mx-auto max-w-md rounded-t-xl border border-current/20 bg-inherit p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Aa</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm underline"
        >
          Close
        </button>
      </div>

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium">Font</legend>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((f) => (
            <label
              key={f.value}
              className="flex cursor-pointer items-center gap-2 rounded border border-current/20 px-2 py-1.5 text-sm has-[:checked]:border-current has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="font"
                value={f.value}
                checked={style.font === f.value}
                onChange={() => onChange({ font: f.value })}
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-4">
        <label htmlFor="text-size" className="mb-1 block text-sm font-medium">
          Text size: <output>{style.sizeStep}</output> of 10
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Smaller text"
            onClick={() => setSize(style.sizeStep - 1)}
            disabled={style.sizeStep <= 1}
            className="rounded border border-current/20 px-2 text-sm disabled:opacity-40"
          >
            A
          </button>
          <input
            id="text-size"
            type="range"
            min={1}
            max={10}
            step={1}
            value={style.sizeStep}
            onChange={(e) => setSize(Number(e.target.value))}
            className="flex-1"
          />
          <button
            type="button"
            aria-label="Larger text"
            onClick={() => setSize(style.sizeStep + 1)}
            disabled={style.sizeStep >= 10}
            className="rounded border border-current/20 px-2 text-xl disabled:opacity-40"
          >
            A
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Theme</legend>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-center gap-2 rounded border border-current/20 px-2 py-1.5 text-sm has-[:checked]:border-current has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={style.theme === t.value}
                onChange={() => onChange({ theme: t.value })}
              />
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded-full border border-current/40"
                style={{ background: swatch(t.value) }}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
