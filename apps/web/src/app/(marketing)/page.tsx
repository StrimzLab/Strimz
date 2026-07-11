import type { Metadata } from 'next'
import { OG_IMAGE } from '@/lib/seo'
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { StatsBand } from '@/components/marketing/stats-band'
import { Features } from '@/components/marketing/features'
import { Benefits } from '@/components/marketing/benefits'
import { Developers } from '@/components/marketing/developers'
import { PricingTeaser } from '@/components/marketing/pricing-teaser'
import { Faqs } from '@/components/marketing/faqs'
import { ClosingCta } from '@/components/marketing/cta'

export const metadata: Metadata = {
  // Override the title template for the homepage. We want the bare
  // brand line, not "Home · Strimz".
  title: { absolute: 'Strimz. Stablecoin billing infrastructure' },
  description:
    'B2B subscription billing on stablecoins. One API for one-shot payments, recurring charges, refunds, webhooks, and an AI AutoPay Agent. All settled in USDC on Arc.',
  openGraph: {
    title: 'Strimz. Stablecoin billing infrastructure',
    description:
      'One API for stablecoin one-shot, subscription, and AI-driven payments. Settled in USDC on Arc.',
    url: '/',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <StatsBand />
      <Features />
      <Benefits />
      <Developers />
      <PricingTeaser />
      <Faqs />
      <ClosingCta />
    </>
  )
}
