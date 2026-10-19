import type { Metadata } from 'next'
import { OG_IMAGE } from '@/lib/seo'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'
import { Closing } from '@/components/marketing/home/closing'
import { Faq } from '@/components/marketing/home/faq'
import { PRICING_FAQS } from '@/components/marketing/home/faq-data'
import { CompareTable } from '@/components/marketing/pricing/compare-table'
import { FeeCalculator } from '@/components/marketing/pricing/fee-calculator'
import { PlanCards } from '@/components/marketing/pricing/plan-cards'
import { PlanRail } from '@/components/marketing/pricing/plan-rail'
import { PricingHero } from '@/components/marketing/pricing/pricing-hero'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Strimz pricing. 0% on your first $1,000 processed, then 0.5%, then 0.4% from $50,000. No monthly fees. Plans move up automatically as you grow.',
  openGraph: {
    title: 'Pricing · Strimz',
    description: 'Start free at 0%. Plans move up automatically with your volume. No monthly fees.',
    url: '/pricing',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return (
    <>
      <SectionBoundary name="pricing hero">
        <PricingHero />
      </SectionBoundary>
      <SectionBoundary name="plans">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
          <PlanCards showExcluded />
        </div>
      </SectionBoundary>
      <SectionBoundary name="plan rail">
        <PlanRail />
      </SectionBoundary>
      <SectionBoundary name="fee calculator">
        <section aria-label="Fee calculator" className="px-5 pb-20 sm:px-10 sm:pb-28">
          <FeeCalculator />
        </section>
      </SectionBoundary>
      <SectionBoundary name="plan comparison">
        <CompareTable />
      </SectionBoundary>
      <SectionBoundary name="pricing questions">
        <Faq title="Pricing questions." items={PRICING_FAQS} id="pricing-faq-title" />
      </SectionBoundary>
      <SectionBoundary name="closing">
        <Closing startHref="/login" />
      </SectionBoundary>
    </>
  )
}
