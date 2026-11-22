import { PLANS } from '@strimz/shared-config'
import { introOrder } from '../motion/intro'

const usd = (n: number | null) => `$${(n ?? 0).toLocaleString('en-US')}`
const rate = (bps: number | null) => `${(bps ?? 0) / 100}%`

export function PricingHero() {
  return (
    <section aria-labelledby="pricing-page-title" className="pb-14 pt-16 sm:pt-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <p
          data-intro
          data-fade
          style={introOrder(0)}
          className="font-poppins bg-card text-foreground ring-border inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ring-1"
        >
          <span className="bg-accent size-1.5 rounded-full" />
          Pricing
        </p>
        <h1
          id="pricing-page-title"
          className="font-sora text-foreground mt-5 max-w-4xl text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]"
        >
          <span className="sr-only">Pay only for what you process.</span>
          <span aria-hidden className="block overflow-hidden pb-[0.06em]">
            <span data-intro data-line style={introOrder(0)} className="block">
              Pay only for
            </span>
          </span>
          <span aria-hidden className="block overflow-hidden pb-[0.1em]">
            <span data-intro data-line style={introOrder(1)} className="block">
              what you process.
            </span>
          </span>
        </h1>
        <p
          data-intro
          data-fade
          style={introOrder(1)}
          className="font-poppins text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
        >
          {rate(PLANS.free.feeBps)} on your first {usd(PLANS.starter.entersAtVolume)}, then{' '}
          {rate(PLANS.starter.feeBps)}, and {rate(PLANS.growth.feeBps)} from{' '}
          {usd(PLANS.growth.entersAtVolume)}. No monthly fee, and your rate never moves back up.
        </p>
      </div>
    </section>
  )
}
