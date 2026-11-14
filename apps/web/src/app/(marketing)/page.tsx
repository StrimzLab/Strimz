import type { Metadata } from 'next'
import { OG_IMAGE } from '@strimz/web-shared/lib/seo'
import { Hero } from '@/components/marketing/home/hero'
import { WhoItsFor } from '@/components/marketing/home/who-its-for'
import { Manifesto } from '@/components/marketing/home/manifesto'
import { HowItWorks } from '@/components/marketing/home/how-it-works'
import { ProductTour } from '@/components/marketing/home/product-tour'
import { Assurances } from '@/components/marketing/home/assurances'
import { BillingTools } from '@/components/marketing/home/billing-tools'
import { Developers } from '@/components/marketing/home/developers'
import { Pricing } from '@/components/marketing/home/pricing'
import { Faq } from '@/components/marketing/home/faq'
import { Closing } from '@/components/marketing/home/closing'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'
import { FAQS } from '@/components/marketing/home/faq-data'
import { JsonLd } from '@strimz/web-shared/components/json-ld'
import { faqPageLd, softwareApplicationLd } from '@strimz/web-shared/lib/structured-data'

const TITLE = 'Strimz. Get paid in USDC and EURC, in seconds'
const DESCRIPTION =
  'Take one-time and subscription payments in USDC and EURC, from customers anywhere. Built for businesses in Nigeria, Kenya, Ghana and across Africa. Paid into your own wallet in seconds.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/', images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={[softwareApplicationLd(), faqPageLd(FAQS)]} />
      <SectionBoundary name="introduction">
        <Hero />
      </SectionBoundary>
      <SectionBoundary name="who it's for">
        <WhoItsFor />
      </SectionBoundary>
      <SectionBoundary name="why Strimz">
        <Manifesto />
      </SectionBoundary>
      <SectionBoundary name="how it works">
        <HowItWorks />
      </SectionBoundary>
      <SectionBoundary name="product tour">
        <ProductTour />
      </SectionBoundary>
      <SectionBoundary name="guarantees">
        <Assurances />
      </SectionBoundary>
      <SectionBoundary name="billing tools">
        <BillingTools />
      </SectionBoundary>
      <SectionBoundary name="developer">
        <Developers />
      </SectionBoundary>
      <SectionBoundary name="pricing">
        <Pricing />
      </SectionBoundary>
      <SectionBoundary name="questions">
        <Faq />
      </SectionBoundary>
      <SectionBoundary name="get started">
        <Closing />
      </SectionBoundary>
    </>
  )
}
