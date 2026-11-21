import clsx from 'clsx'

/** The Slott mark: three storage slots, the middle one holding a pallet. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Slott">
      <rect width="512" height="512" rx="112" fill="#0E2238" />
      <rect x="160" y="132" width="224" height="68" rx="34" fill="#EEF3F6" />
      <rect x="128" y="222" width="256" height="68" rx="34" fill="#EEF3F6" />
      <rect x="262" y="230" width="112" height="52" rx="18" fill="#5B9AE0" />
      <rect x="128" y="312" width="224" height="68" rx="34" fill="#EEF3F6" />
    </svg>
  )
}

/** Mark plus the name, for headers and the sign-in card. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-white/10" />
      <span className={clsx('font-display text-2xl font-bold leading-none tracking-tight', light ? 'text-white' : 'text-ink')}>Slott</span>
    </span>
  )
}
