import type { Metadata } from 'next'
import boltIcon from '@iconify-icons/solar/bolt-linear'
import documentIcon from '@iconify-icons/solar/document-text-linear'
import globeIcon from '@iconify-icons/solar/globus-linear'
import lockIcon from '@iconify-icons/solar/lock-keyhole-linear'
import shieldIcon from '@iconify-icons/solar/shield-check-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import { cn } from '@strimz/ui'
import { OG_IMAGE } from '@/lib/seo'
import { MkIcon } from '@/components/marketing/icon'
import { PageHero } from '@/components/marketing/page-hero'
import { RiseIn } from '@/components/marketing/fx/rise-in'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'
import { Closing } from '@/components/marketing/home/closing'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Strimz is billing for businesses that get paid in stablecoins. Payments settle into your own wallet in seconds, in USDC or EURC, and every one leaves an on-chain receipt.',
  openGraph: {
    title: 'About Strimz',
    description:
      'Billing for businesses that get paid in stablecoins: non-custodial, settled in seconds, with on-chain receipts.',
    url: '/about',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/about' },
}

const WHY = [
  {
    icon: boltIcon,
    title: 'Paid in seconds',
    body: 'Payments settle in seconds, straight into your wallet. The money is yours moments after your customer approves.',
  },
  {
    icon: shieldIcon,
    title: 'Final once it settles',
    body: 'A settled payment is final on-chain. When Strimz tells you a payment landed, it has landed.',
  },
  {
    icon: globeIcon,
    title: 'Customers anywhere',
    body: 'Anyone holding USDC or EURC can pay you, wherever they are. They sign in their wallet and never need gas.',
  },
] as const

const SAFETY = [
  {
    icon: walletIcon,
    title: 'We never hold your money',
    body: 'Strimz is non-custodial. Every payment settles directly into a wallet you control, so there is no Strimz balance to withdraw.',
  },
  {
    icon: documentIcon,
    title: 'A receipt for every payment',
    body: 'Each payment is an on-chain transaction. You, your customer or your accountant can check it independently.',
  },
  {
    icon: lockIcon,
    title: 'Privately audited contracts',
    body: 'The smart contracts that move payments have been through a private security audit.',
  },
] as const

const FACTS = [
  { value: '1', label: 'Approval covers every renewal' },
  { value: '2', label: 'Stablecoins: USDC and EURC' },
  { value: '0', label: 'Gas your customers pay' },
  { value: '0', label: 'Funds we hold for you' },
] as const

function Pillars({ items }: { items: typeof WHY | typeof SAFETY }) {
  return (
    <RiseIn className="mt-12 grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          data-rise
          className="border-border bg-card rounded-[24px] border p-7"
        >
          <span className="bg-accent/10 text-accent-ink dark:text-accent grid size-11 place-items-center rounded-xl">
            <MkIcon icon={item.icon} className="size-5" />
          </span>
          <h3 className="font-sora text-foreground mt-6 text-xl font-semibold tracking-[-0.02em]">
            {item.title}
          </h3>
          <p className="font-poppins text-muted-foreground mt-2 text-[15px] leading-relaxed">
            {item.body}
          </p>
        </article>
      ))}
    </RiseIn>
  )
}

export default function AboutPage() {
  return (
    <>
      <SectionBoundary name="about introduction">
        <PageHero
          id="about-title"
          label="About"
          lines={['Billing for businesses', 'paid in stablecoins.']}
          intro="Strimz gives an online business the billing it needs: hosted checkout, subscriptions, invoices, refunds and reporting, with every payment settling in USDC or EURC straight into its own wallet."
        />
      </SectionBoundary>

      <SectionBoundary name="why stablecoins">
        <section aria-labelledby="why-title" className="py-16 sm:py-24">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
            <h2
              id="why-title"
              className="font-sora text-foreground max-w-2xl text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
            >
              Why stablecoins work for business.
            </h2>
            <Pillars items={WHY} />
          </div>
        </section>
      </SectionBoundary>

      <SectionBoundary name="safety">
        <section aria-labelledby="safety-title" className="bg-muted py-16 sm:py-24">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
            <h2
              id="safety-title"
              className="font-sora text-foreground max-w-2xl text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
            >
              How we keep your money safe.
            </h2>
            <Pillars items={SAFETY} />
          </div>
        </section>
      </SectionBoundary>

      <SectionBoundary name="facts">
        <section aria-label="Strimz in numbers" className="py-16 sm:py-24">
          <RiseIn className="border-border mx-5 grid max-w-[1200px] grid-cols-2 border-y sm:mx-10 md:grid-cols-4 xl:mx-auto">
            {FACTS.map((f, i) => (
              <div
                key={f.label}
                data-rise
                className={cn(
                  'border-border py-10 pr-6 md:py-14',
                  i % 2 === 1 && 'border-l pl-6',
                  i > 0 && 'md:border-l md:pl-8',
                  i > 1 && 'border-t md:border-t-0',
                )}
              >
                <p className="font-sora text-accent-ink dark:text-accent text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  {f.value}
                </p>
                <p className="font-poppins text-muted-foreground mt-3 max-w-[14rem] text-sm">
                  {f.label}
                </p>
              </div>
            ))}
          </RiseIn>
        </section>
      </SectionBoundary>

      <SectionBoundary name="closing">
        <Closing />
      </SectionBoundary>
    </>
  )
}
