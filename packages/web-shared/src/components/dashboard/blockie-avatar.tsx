'use client'

import { useEffect, useState } from 'react'
import Blockies from 'react-blockies'

interface BlockieAvatarProps {
  /**
   * Seed the blockie art with. For Strimz merchants we prefer their
   * Privy embedded-wallet address (48 hex chars → wide colour space);
   * fallback is the login email so the avatar stays deterministic
   * even before the wallet resolves. `null` renders a neutral chip
   * so the topbar layout doesn't jump between hydration + first paint.
   */
  seed: string | null
  /** Rendered edge length in pixels. */
  size?: number
  className?: string
}

/**
 * Deterministic blockies avatar. Wraps `react-blockies` ,  a
 * canvas-based 8x8 grid renderer that produces the same pixel art
 * for the same seed every time. So a merchant's avatar identifies
 * them across the platform without a photo upload.
 *
 * SSR note: `react-blockies` draws into `<canvas>` and reads the pixel
 * grid to a data URL, which needs `window`. We guard first render with
 * a mounted flag so the server output is a matching-size neutral chip;
 * this eliminates the hydration mismatch that happens if we let
 * Blockies attempt to render server-side.
 */
export function BlockieAvatar({ seed, size = 32, className }: BlockieAvatarProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Blockies expects a size arg (grid squares, default 8) and a scale
  // (pixels per square). We fix the grid at 8 for a distinct look; the
  // caller controls the actual pixel size via `size`.
  const scale = Math.max(1, Math.floor(size / 8))

  if (!mounted || !seed) {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, rgba(2,199,106,0.20) 0%, rgba(2,199,106,0.05) 100%)',
        }}
      />
    )
  }

  return (
    <span
      className={`strimz-blockie ${className ?? ''}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '9999px',
        overflow: 'hidden',
        lineHeight: 0,
      }}
    >
      <Blockies
        seed={seed.toLowerCase()}
        size={8}
        scale={scale}
        // Random `spotColor` looks bad on our brand. Pin the palette
        // so avatars sit next to the green primary without clashing.
        color="#02C76A"
        bgColor="#050020"
        spotColor="#FBBF24"
      />
    </span>
  )
}
