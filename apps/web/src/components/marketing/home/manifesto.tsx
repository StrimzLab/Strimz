'use client'

import { GooeyTextReveal } from '../fx/gooey-reveal'

export function Manifesto() {
  return (
    <section
      aria-label="Why Strimz"
      className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-24"
    >
      <GooeyTextReveal
        mode="scrub"
        start="top 85%"
        end="bottom 55%"
        stagger={0.25}
        blurAmount={0.45}
        className="font-sora max-w-[24ch] space-y-6 text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[46px] lg:text-[60px]"
      >
        <p className="text-muted-foreground">
          One link. One approval. Every renewal charged on schedule, in USDC or EURC.
        </p>
        <p className="text-foreground">
          Each payment settles on-chain and the money is{' '}
          <span className="text-accent">in your own wallet in seconds.</span>
        </p>
      </GooeyTextReveal>
    </section>
  )
}
