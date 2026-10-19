import type { Metadata } from 'next'
import { OG_IMAGE } from '@/lib/seo'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'
import { Closing } from '@/components/marketing/home/closing'
import { CaseStudiesSection } from '@/components/marketing/use-cases/case-studies-section'
import { USE_CASES } from '@/components/marketing/use-cases/data'
import { UseCaseSection } from '@/components/marketing/use-cases/use-case-section'
import { UseCasesHero } from '@/components/marketing/use-cases/use-cases-hero'

export const metadata: Metadata = {
  title: 'Use cases',
  description:
    'How SaaS teams, marketplaces, creators, agencies and global B2B sellers bill with Strimz: subscriptions, payment links, invoices and storefronts, settled in USDC or EURC.',
  openGraph: {
    title: 'Use cases · Strimz',
    description:
      'How SaaS, marketplace, creator, agency and global B2B businesses bill with Strimz.',
    url: '/use-cases',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/use-cases' },
}

export default function UseCasesPage() {
  return (
    <>
      <SectionBoundary name="use cases introduction">
        <UseCasesHero />
      </SectionBoundary>
      {USE_CASES.map((useCase, i) => (
        <SectionBoundary key={useCase.id} name={`${useCase.label} use case`}>
          <UseCaseSection useCase={useCase} flip={i % 2 === 1} />
        </SectionBoundary>
      ))}
      <SectionBoundary name="case studies">
        <CaseStudiesSection />
      </SectionBoundary>
      <SectionBoundary name="closing">
        <Closing />
      </SectionBoundary>
    </>
  )
}
