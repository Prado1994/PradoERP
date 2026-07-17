import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  style?: CSSProperties
}

const base = (size: number, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style: { flexShrink: 0, ...style },
})

export const InboxIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
)

export const ClockIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
)

export const BoardIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <rect x="3.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="9.75" y="4" width="4.5" height="10" rx="1.2" />
    <rect x="16" y="4" width="4.5" height="13" rx="1.2" />
  </svg>
)

export const FolderIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)

export const DocIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </svg>
)

export const CubeIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M3 8l9-5 9 5-9 5-9-5z" />
    <path d="M3 8v9l9 5 9-5V8" />
    <path d="M12 13v9" />
  </svg>
)

export const ChartIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M4 20V11" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
  </svg>
)

export const CalendarIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
)

export const TargetIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

export const TrendUpIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M4 16l6-6 4 4 6-8" />
    <path d="M14 6h6v6" />
  </svg>
)

export const RefreshIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M4 4v5h5" />
    <path d="M20 20v-5h-5" />
    <path d="M5 15a8 8 0 0 0 14.3 3.5M19 9A8 8 0 0 0 4.7 5.5" />
  </svg>
)

export const GearIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M4.2 4.9l2.1 2.1M17.7 17l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.1l2.1-2.1M17.7 7l2.1-2.1" />
  </svg>
)

export const SunIcon = ({ size = 17, style }: IconProps) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const MoonIcon = ({ size = 17, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  </svg>
)

export const ChevronLeftIcon = ({ size = 16, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

export const ChevronDownIcon = ({ size = 14, style }: IconProps) => (
  <svg {...base(size, style)} strokeWidth={2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const MenuIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size, style)} strokeWidth={2}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
)

export const BellIcon = ({ size = 17, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)

export const SearchIcon = ({ size = 16, style }: IconProps) => (
  <svg {...base(size, style)} strokeWidth={2}>
    <circle cx="10" cy="10" r="6" />
    <path d="M20 20l-5-5" />
  </svg>
)

export const PlusIcon = ({ size = 16, style }: IconProps) => (
  <svg {...base(size, style)} strokeWidth={2.2} strokeLinejoin={undefined}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const SendIcon = ({ size = 17, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, ...style }}>
    <path d="M3 11l18-8-8 18-2-8-8-2z" />
  </svg>
)

export const CloseIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const UsersIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="8" r="3.2" />
    <path d="M22 20v-2a4 4 0 0 0-3-3.8" />
    <path d="M15.5 4.2a3.2 3.2 0 0 1 0 6" />
  </svg>
)

export const MailIcon = ({ size = 15, style }: IconProps) => (
  <svg {...base(size, style)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
)

export const PhoneIcon = ({ size = 15, style }: IconProps) => (
  <svg {...base(size, style)}>
    <path d="M6 3h3l2 5-2.5 2.5a12 12 0 0 0 6 6L17 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" />
  </svg>
)
