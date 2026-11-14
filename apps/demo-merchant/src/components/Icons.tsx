import type { SVGProps } from 'react'

export function FanlineMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden {...props}>
      <rect width="64" height="64" rx="16" fill="#1e1033" />
      <g fill="#ff2b62">
        <rect x="13" y="26" width="6" height="16" rx="3" />
        <rect x="23" y="18" width="6" height="28" rx="3" />
        <rect x="35" y="22" width="6" height="22" rx="3" />
      </g>
      <rect x="45" y="30" width="6" height="10" rx="3" fill="#ffb020" />
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
