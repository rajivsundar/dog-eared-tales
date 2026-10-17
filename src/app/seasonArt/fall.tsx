/* eslint-disable react-refresh/only-export-components -- the file exports the season's set of drawings, not one component */
import { useEffect, useState } from 'react'
import type { SeasonArt } from './types'

/**
 * Fall artwork. Every shape here is drawn for Twice Told: no photos, stock images or other
 * people's art. Colours come from the app's theme tokens (ink, page, accent), so the drawings
 * read on Paper, Sepia, Night and Black. Only the lamp light and the autumn leaves keep fixed
 * warm colours.
 */

const LEAF_COLORS = ['#c2571a', '#d9962b', '#a63d1f', '#b8791d']

/**
 * Three leaves, each drawn in a 32-unit box with a stem at the bottom: a maple, an oak and a
 * simple oval leaf. `body` is the outline, `veins` the lines inside it.
 */
const LEAVES_SHAPES = {
  maple: {
    body: 'M16 2L18.6 8.4 23.5 6.5 22 12.5 28.5 11.5 25 16.5 30 19.5 22.5 20.5 23.5 25 17 23.2 16 25 15 23.2 8.5 25 9.5 20.5 2 19.5 7 16.5 3.5 11.5 10 12.5 8.5 6.5 13.4 8.4Z',
    veins: 'M16 24V7M16 21L8 15M16 21L24 15',
  },
  oak: {
    body: 'M16 3C19 3 19 7 21 7 24 6 25 9 23.5 11 27 12 26.5 16 23.5 17 26 19.5 24 23 21 22 20 25 17.5 25 16 24 14.5 25 12 25 11 22 8 23 6 19.5 8.5 17 5.5 16 5 12 8.5 11 7 9 8 6 11 7 13 7 13 3 16 3Z',
    veins: 'M16 24V6M16 20L10 15M16 20L22 15',
  },
  oval: {
    body: 'M16 3C25 8 26 19 16 25 6 19 7 8 16 3Z',
    veins: 'M16 25V6M16 19L10.5 14M16 19L21.5 14',
  },
}
type LeafKind = keyof typeof LEAVES_SHAPES

/** A leaf with a visible stem. Its fill is the `color` of the element; the outline is the theme ink. */
function LeafShape({
  kind,
  size,
  className,
  style,
}: {
  kind: LeafKind
  /** Width and height, for a leaf drawn inside another drawing. */
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  const { body, veins } = LEAVES_SHAPES[kind]
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path
        d="M16 24.5L16.6 31"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={body}
        fill="currentColor"
        stroke="var(--ink)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d={veins}
        stroke="var(--ink)"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  )
}

/** A lamplit reading chair with an open book and a leaf bookmark. */
function Scene() {
  return (
    <svg
      viewBox="0 0 260 220"
      aria-hidden="true"
      data-testid="season-scene"
      className="h-auto w-full overflow-visible"
    >
      <defs>
        <radialGradient id="tt-lamp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The glow of the lamp */}
      <circle cx="205" cy="82" r="92" fill="url(#tt-lamp-glow)" />
      {/* Floor */}
      <path
        d="M14 202h232"
        className="stroke-ink"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Floor lamp */}
      <path
        d="M205 100v100"
        className="stroke-ink"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx="205"
        cy="202"
        rx="18"
        ry="4"
        className="fill-ink"
        opacity="0.55"
      />
      <path
        d="M184 100l8-40h26l8 40z"
        fill="#e8a23b"
        className="stroke-ink"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M192 62h26" stroke="#fff3cf" strokeWidth="3" opacity="0.7" />
      {/* Chair: back, seat, arms, legs */}
      <rect
        x="38"
        y="64"
        width="104"
        height="104"
        rx="28"
        className="fill-accent/35 stroke-ink"
        strokeWidth="3"
      />
      <rect
        x="26"
        y="138"
        width="128"
        height="36"
        rx="13"
        className="fill-accent/60 stroke-ink"
        strokeWidth="3"
      />
      <rect
        x="20"
        y="112"
        width="28"
        height="64"
        rx="13"
        className="fill-accent/50 stroke-ink"
        strokeWidth="3"
      />
      <rect
        x="132"
        y="112"
        width="28"
        height="64"
        rx="13"
        className="fill-accent/50 stroke-ink"
        strokeWidth="3"
      />
      <path
        d="M40 176l-4 24M140 176l4 24"
        className="stroke-ink"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* An open book on the seat */}
      <path
        d="M58 132l32-8 32 8v22l-32-8-32 8z"
        className="fill-page stroke-ink"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M90 124v22" className="stroke-ink" strokeWidth="2" />
      <path
        d="M65 136l20-5M65 143l20-5M95 131l20 5M95 138l20 5"
        className="stroke-ink"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* The leaf bookmark, standing out of the book */}
      <path
        d="M104 130l9-14"
        className="stroke-ink"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <g transform="translate(99 98) rotate(20 16 30)">
        <LeafShape kind="maple" size={26} style={{ color: '#c2571a' }} />
      </g>
    </svg>
  )
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )
  useEffect(() => {
    const onChange = (): void =>
      setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return hidden
}

const LEAVES: {
  left: number
  size: number
  delay: number
  duration: number
  rest: number
  kind: LeafKind
}[] = [
  { left: 4, size: 38, delay: 0, duration: 13, rest: 16, kind: 'maple' },
  { left: 24, size: 28, delay: 3.5, duration: 17, rest: 60, kind: 'oak' },
  { left: 44, size: 34, delay: 7, duration: 15, rest: 34, kind: 'oval' },
  { left: 62, size: 30, delay: 1.5, duration: 18, rest: 76, kind: 'maple' },
  { left: 72, size: 36, delay: 5, duration: 14, rest: 22, kind: 'oak' },
  { left: 84, size: 26, delay: 9, duration: 16, rest: 52, kind: 'oval' },
]

/**
 * A few leaves falling behind the illustration (they never cross text: the welcome page puts them
 * only in the illustration area). They stand still when the reader prefers reduced
 * motion, and pause while the tab is hidden.
 */
function Leaves() {
  const reduced = useReducedMotion()
  const hidden = useTabHidden()
  return (
    <div
      aria-hidden="true"
      data-testid="season-leaves"
      data-motion={reduced ? 'static' : 'animated'}
      data-paused={hidden ? 'true' : 'false'}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <style>{`
        .tt-leaf { position: absolute; top: var(--rest); opacity: .92;
          animation: tt-fall var(--duration) linear var(--delay) infinite; }
        @keyframes tt-fall {
          0% { top: -8%; transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(14px) rotate(70deg); }
          50% { transform: translateX(-10px) rotate(150deg); }
          75% { transform: translateX(12px) rotate(230deg); }
          100% { top: 104%; transform: translateX(0) rotate(320deg); }
        }
        [data-motion='static'] .tt-leaf { animation: none; transform: rotate(var(--tilt)); }
        [data-paused='true'] .tt-leaf { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .tt-leaf { animation: none; transform: rotate(var(--tilt)); }
        }
      `}</style>
      {LEAVES.map((leaf, i) => (
        <LeafShape
          key={i}
          kind={leaf.kind}
          className="tt-leaf"
          style={{
            left: `${leaf.left}%`,
            width: leaf.size,
            height: leaf.size,
            color: LEAF_COLORS[i % LEAF_COLORS.length],
            ['--rest' as string]: `${leaf.rest}%`,
            ['--delay' as string]: `-${leaf.delay}s`,
            ['--duration' as string]: `${leaf.duration}s`,
            ['--tilt' as string]: `${(i * 47) % 360}deg`,
          }}
        />
      ))}
    </div>
  )
}

/** A small leaf beside the Your Shortlist heading. */
function Accent() {
  return (
    <LeafShape
      kind="maple"
      className="mr-2 inline-block size-8 align-[-0.2em]"
      style={{ color: '#c2571a' }}
    />
  )
}

const art: SeasonArt = { Scene, Leaves, Accent }
export default art
