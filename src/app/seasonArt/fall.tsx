/* eslint-disable react-refresh/only-export-components -- the file exports the season's set of drawings, not one component */
import { useEffect, useState } from 'react'
import type { SeasonArt } from './types'

/**
 * Fall artwork. Every shape here is drawn for Twice Told: no photos, stock images or other
 * people's art. Colours come from the app's theme tokens (ink, page, accent), so the drawings
 * read on Paper, Sepia, Night and Black. Only the lamp light and the autumn leaves keep fixed
 * warm colours.
 */

const LEAF_COLORS = ['#c2571a', '#d9962b', '#8c3b1f', '#b5651d']

/** A rounded leaf (viewBox 24). */
const ROUND_LEAF = 'M12 2C6 6 4 12 12 22 20 12 18 6 12 2Z'
/** A lobed, maple-like leaf (viewBox 24). */
const LOBED_LEAF = 'M12 2l2 5 5-1-3 5 5 2-6 2 1 6-4-3-4 3 1-6-6-2 5-2-3-5 5 1z'

function LeafShape({
  lobed,
  className,
  style,
}: {
  lobed?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path
        d={lobed ? LOBED_LEAF : ROUND_LEAF}
        fill="currentColor"
        stroke="var(--ink)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {!lobed && (
        <path
          d="M12 6v14"
          stroke="var(--ink)"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.5"
        />
      )}
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
      <path
        d={LOBED_LEAF}
        transform="translate(96 104) rotate(22 12 22) scale(0.85)"
        fill="#c2571a"
        className="stroke-ink"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
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

const LEAVES = [
  { left: 6, size: 22, delay: 0, duration: 13, rest: 18, lobed: false },
  { left: 22, size: 16, delay: 3.5, duration: 17, rest: 62, lobed: true },
  { left: 41, size: 26, delay: 7, duration: 15, rest: 36, lobed: true },
  { left: 63, size: 18, delay: 1.5, duration: 18, rest: 78, lobed: false },
  { left: 80, size: 24, delay: 5, duration: 14, rest: 24, lobed: true },
  { left: 93, size: 15, delay: 9, duration: 16, rest: 55, lobed: false },
]

/**
 * A few leaves falling behind the welcome page. They stand still when the reader prefers reduced
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
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      <style>{`
        .tt-leaf { position: absolute; top: var(--rest); opacity: .7;
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
          lobed={leaf.lobed}
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
      lobed
      className="mr-2 inline-block size-6 align-[-0.1em]"
      style={{ color: '#c2571a' }}
    />
  )
}

const art: SeasonArt = { Scene, Leaves, Accent }
export default art
