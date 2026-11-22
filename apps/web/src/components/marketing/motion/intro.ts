import type { CSSProperties } from 'react'

/** Position in the hero's CSS intro, so items in the same group stagger. */
export function introOrder(i: number): CSSProperties {
  return { '--intro-i': i } as CSSProperties
}
