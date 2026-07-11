import Image from 'next/image'

/**
 * Brand SVGs the web app ships at `/public/brands/`. Add new tokens
 * here when a third one (EURC, USYC) shows up on Arc. Anything not
 * in this map renders a textual fallback so a typo or unsupported
 * symbol fails visually rather than 404-ing on the image fetch.
 */
const KNOWN_LOGOS: Record<string, string> = {
  USDC: '/brands/USDC.svg',
  USDT: '/brands/USDT.svg',
}

export interface TokenLogoProps {
  symbol: string
  /** Pixel size. Defaults to 24, matches Tailwind `size-6`. */
  size?: number
  className?: string
}

/**
 * Renders the brand mark for a token symbol. Used wherever the UI
 * previously showed a generic letter-in-a-circle or a Lucide coin
 * icon next to a USDC amount.
 *
 * Falls back to the symbol's first character (in the same circular
 * frame) when the asset isn't bundled. Keeps the layout stable
 * regardless of whether the brand mark loads.
 */
export function TokenLogo({ symbol, size = 24, className }: TokenLogoProps) {
  const src = KNOWN_LOGOS[symbol.toUpperCase()]
  if (!src) {
    return (
      <span
        aria-label={symbol}
        className={
          'inline-flex shrink-0 items-center justify-center rounded-full bg-[#02C76A]/10 font-mono text-[10px] font-bold text-[#02C76A] ' +
          (className ?? '')
        }
        style={{ width: size, height: size }}
      >
        {symbol.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <Image
      src={src}
      alt={symbol}
      width={size}
      height={size}
      // Brand marks are intentionally not lazy. The checkout shell
      // wants them immediately visible on first paint.
      priority
      className={'shrink-0 rounded-full ' + (className ?? '')}
    />
  )
}
