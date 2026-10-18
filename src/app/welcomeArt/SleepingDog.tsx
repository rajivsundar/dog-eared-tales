/**
 * The welcome artwork: a dog asleep on the floor at the foot of a couch, beside an open book with
 * one folded corner. Drawn for Dog-Eared Tales as simple line art: no photos, stock images or other
 * people's art. Every colour is one of the app's theme tokens (ink, muted, page, surface, accent),
 * so it reads on Paper, Sepia, Night and Black, and in fall. Decorative only: hidden from screen
 * readers.
 */
export function SleepingDog() {
  return (
    <svg
      data-testid="welcome-dog"
      viewBox="0 0 240 124"
      aria-hidden="true"
      focusable="false"
      className="h-auto w-full fill-none stroke-ink"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The floor */}
      <path d="M6 110H234" className="stroke-line" />

      {/* The couch: back, seat, two arms and four short feet */}
      <rect
        x="18"
        y="18"
        width="118"
        height="50"
        rx="14"
        className="fill-surface"
      />
      <rect
        x="8"
        y="44"
        width="34"
        height="54"
        rx="12"
        className="fill-surface"
      />
      <rect
        x="116"
        y="44"
        width="34"
        height="54"
        rx="12"
        className="fill-surface"
      />
      <rect
        x="32"
        y="60"
        width="104"
        height="32"
        rx="9"
        className="fill-surface"
      />
      <path d="M18 98V108M140 98V108M44 92V108M122 92V108" />
      {/* A cushion seam */}
      <path d="M84 62V90" className="stroke-muted" strokeWidth="1.8" />

      {/* The dog, curled on the floor in front of the couch */}
      <path
        d="M46 108C34 108 34 86 56 80C80 72 118 76 132 92C138 100 134 108 124 108Z"
        className="fill-page"
      />
      {/* Tail, curled round the back */}
      <path d="M46 100C32 100 24 92 28 80" />
      {/* Back leg */}
      <path
        d="M96 108C96 100 104 98 110 104"
        className="stroke-muted"
        strokeWidth="1.8"
      />
      {/* Head, resting on the front paws */}
      <ellipse cx="136" cy="98" rx="14" ry="11" className="fill-page" />
      {/* Floppy ear */}
      <path
        d="M126 90C116 92 114 104 122 107C129 104 131 97 129 91Z"
        className="fill-surface"
      />
      {/* Snout and nose */}
      <path
        d="M146 100C152 100 156 102 156 105C156 108 150 109 143 108"
        className="fill-page"
      />
      <circle cx="155" cy="103.5" r="1.6" className="fill-ink stroke-none" />
      {/* Closed eye */}
      <path d="M137 96C139 99 143 99 145 96" strokeWidth="2" />
      {/* Front paws */}
      <path d="M128 108H150" />

      {/* Z z: asleep */}
      <path
        d="M160 64H169L160 74H169"
        className="stroke-muted"
        strokeWidth="2"
      />
      <path
        d="M176 50H182L176 57H182"
        className="stroke-muted"
        strokeWidth="1.8"
      />

      {/* The open book on the floor, pages face up */}
      <path d="M170 106L198 102V87L170 91Z" className="fill-surface" />
      <path d="M198 102L218 105L230 97V88L198 87Z" className="fill-surface" />
      {/* Lines of text */}
      <path
        d="M175 95L192 93M175 99L192 97M204 94L222 93M204 98L218 98"
        className="stroke-muted"
        strokeWidth="1.4"
      />
      {/* The folded corner: the one touch of colour */}
      <path
        d="M218 105L230 97L220 96Z"
        className="fill-accent/25 stroke-accent"
      />
    </svg>
  )
}
