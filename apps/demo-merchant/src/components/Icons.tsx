import type { SVGProps } from 'react'

export function FanlineWordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 140 24" fill="none" {...props}>
      <text
        x="0"
        y="17"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="20"
        fontWeight={600}
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        fanline
      </text>
      <circle cx="112" cy="12" r="3" fill="#ff2b62" />
    </svg>
  )
}

export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  )
}

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" />
    </svg>
  )
}

export function CoinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M8 12h8M12 8a4 4 0 010 8" />
    </svg>
  )
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  )
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17l-6.1 3.5 1.5-6.8L2.2 9l6.9-.7L12 2z" />
    </svg>
  )
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}
