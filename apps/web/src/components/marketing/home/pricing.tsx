import Link from 'next/link'
import { FeeCalculator } from '../pricing/fee-calculator'
import { PlanCards } from '../pricing/plan-cards'

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="bg-muted scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div className="max-w-2xl">
          <h2
            id="pricing-title"
            className="font-sora text-foreground text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[60px]"
          >
            Pricing that gets cheaper as you grow.
          </h2>
          <p className="font-poppins text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
            A small fee per payment and nothing else. Your first $1,000 is free, and your rate drops
            as your total grows. It never moves back up.
          </p>
        </div>

        <PlanCards className="mt-12" />
        <p className="font-poppins mt-6 text-center text-sm">
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground decoration-accent underline decoration-2 underline-offset-4 transition-colors"
          >
            Compare every plan in detail
          </Link>
        </p>

        <FeeCalculator className="mt-16" />
      </div>
    </section>
  )
}
