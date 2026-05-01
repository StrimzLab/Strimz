import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { Features } from '@/components/marketing/features'
import { Benefits } from '@/components/marketing/benefits'
import { Developers } from '@/components/marketing/developers'
import { PricingTeaser } from '@/components/marketing/pricing-teaser'
import { Faqs } from '@/components/marketing/faqs'
import { ClosingCta } from '@/components/marketing/cta'

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <Benefits />
      <Developers />
      <PricingTeaser />
      <Faqs />
      <ClosingCta />
    </>
  )
}
