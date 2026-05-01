'use client'

import Marquee from 'react-fast-marquee'
import { Glyph } from './logo'

const MESSAGES = [
  'Streamline payments anytime',
  'Settled in USDC on Arc',
  'No gas for your customers',
  'AI AutoPay Agent included',
  'Webhook-signed by HMAC-SHA256',
  'Cross-chain via CCTP V2',
] as const

/**
 * Horizontal marquee shown beneath the marketing hero. Pure decorative —
 * but it lifts the section visually and gives a sense of motion that
 * static screenshots never get.
 */
export function MovingText() {
  return (
    <div className="border-y border-border/40 bg-muted/20">
      <Marquee gradient gradientColor="hsl(var(--background))" speed={36} pauseOnHover>
        {MESSAGES.concat(MESSAGES).map((msg, i) => (
          <Pill key={i}>{msg}</Pill>
        ))}
      </Marquee>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-6 inline-flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <Glyph className="size-4" />
      {children}
    </span>
  )
}
