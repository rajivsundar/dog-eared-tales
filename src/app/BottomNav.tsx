import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { ProfileDot } from '../features/profiles/ProfileDot'
import { useProfiles } from '../features/profiles/useProfiles'

const icon = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const TABS: { to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Shortlist',
    end: true,
    icon: (
      <svg {...icon}>
        <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </svg>
    ),
  },
  {
    to: '/library',
    label: 'Library',
    icon: (
      <svg {...icon}>
        <path d="M5 4h4v16H5zM11 4h4v16h-4zM17.5 5l3.5 1-3.5 14-3.5-1z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg {...icon}>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    ),
  },
]

/** The page with the bottom navigation: Shortlist, Library and Settings. The reader does not use it. */
export function WithBottomNav() {
  const profiles = useProfiles()
  const guest = profiles.mode === 'guest'
  // The dot shows who is reading, but only when there is a choice of readers.
  const who = guest
    ? { name: 'a guest', color: 'slate' as const }
    : profiles.profiles.length >= 2 && profiles.active
      ? profiles.active
      : null
  return (
    <>
      <div className="pb-[calc(var(--nav-height)+1rem)]">
        <Outlet />
      </div>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex h-(--nav-height) border-t border-line bg-surface"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent ${
                isActive
                  ? 'border-t-2 border-accent font-semibold text-accent'
                  : 'border-t-2 border-transparent text-muted'
              }`
            }
          >
            <span className="relative">
              {tab.icon}
              {tab.to === '/settings' && who && (
                <span
                  role="img"
                  aria-label={`Reading as ${who.name}`}
                  className="absolute -top-0.5 -right-1.5"
                >
                  <ProfileDot color={who.color} size="sm" dashed={guest} />
                </span>
              )}
            </span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
