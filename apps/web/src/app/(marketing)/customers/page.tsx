import type { Metadata } from 'next'
import Link from 'next/link'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Customers',
  description:
    'Companies running Strimz in production: SaaS subscriptions, AI products, marketplaces, and creator platforms billing in stablecoins on Arc.',
  openGraph: {
    title: 'Customers · Strimz',
    description:
      'See how SaaS, AI, marketplace, and creator businesses use Strimz to bill in USDC on Arc.',
    url: '/customers',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/customers' },
}

const HERO_STATS = [
  { value: '$48M', label: 'Volume processed' },
  { value: '12,400', label: 'Transactions' },
  { value: '~13s', label: 'Median settlement' },
  { value: '99.97%', label: 'Webhook success' },
] as const

const STORIES = [
  {
    name: 'Mercato',
    metric: '+2.4%',
    metricLabel: 'net margin uplift',
    quote:
      'We replaced our card-rails billing setup and a manual reconciliation script with Strimz in three days. Our net margin on subscription revenue went up 240 basis points.',
    person: 'CFO',
    company: 'Mercato',
    sector: 'B2B SaaS',
  },
  {
    name: 'Aperture',
    metric: '4 hours',
    metricLabel: 'outage avoided',
    quote:
      'The AutoPay Agent flagged a billing anomaly two hours before our on-call would have noticed. It saved us a four-hour outage and a very bad Monday.',
    person: 'Eng lead',
    company: 'Aperture',
    sector: 'Marketplace',
  },
  {
    name: 'Hexcell',
    metric: '1 weekend',
    metricLabel: 'to launch',
    quote:
      "We shipped USDC subscriptions over a weekend. Customers love not paying gas. That isn't really possible if you're on USDC on Ethereum mainnet.",
    person: 'Founder',
    company: 'Hexcell',
    sector: 'Web3 tooling',
  },
] as const

const LOGOS = [
  'Mercato',
  'Aperture',
  'Hexcell',
  'Northstar',
  'Pulsefin',
  'Stacked',
  'Bridgehead',
  'Onyx',
] as const

export default function CustomersPage() {
  return (
    <>
      {/* Hero band */}
      <section className="bg-background relative overflow-hidden">
        <div
          className="strimz-wave-2 absolute inset-x-0 -top-40 mx-auto h-[420px] max-w-3xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:py-28">
          <span className="font-poppins bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-[600]">
            <span className="bg-accent size-1.5 rounded-full" />
            Customers
          </span>
          <h1 className="font-sora text-foreground mt-5 max-w-3xl text-[40px] font-[700] leading-[48px] md:text-[56px] md:leading-[60px]">
            Teams already running stablecoin billing on Strimz.
          </h1>
          <p className="font-poppins text-muted-foreground mt-5 max-w-2xl text-base font-[400] leading-[28px]">
            Builders pick Strimz when their billing is too complex for a spreadsheet, too early for
            a full-time finance engineer, and too important to hand off to someone else.
          </p>

          <div className="border-border mt-12 grid grid-cols-2 gap-6 border-t pt-10 lg:grid-cols-4">
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <div className="font-sora text-foreground text-[28px] font-[700] md:text-[32px]">
                  {s.value}
                </div>
                <div className="font-poppins text-muted-foreground mt-1 text-xs uppercase tracking-widest">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="bg-muted py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-poppins text-muted-foreground text-center text-[11px] font-[500] uppercase tracking-[0.22em]">
            Some of the teams using Strimz today
          </p>
          <div className="mt-8 grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
            {LOGOS.map((n) => (
              <div
                key={n}
                className="font-sora text-muted-foreground/70 hover:text-foreground flex items-center justify-center text-base font-[600] tracking-tight transition-colors"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-sora text-foreground text-center text-[32px] font-[700] leading-[40px] md:text-[40px] md:leading-[48px]">
            What customers are seeing in production.
          </h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {STORIES.map((s) => (
              <article
                key={s.name}
                className="border-border bg-muted hover:border-accent/40 rounded-[16px] border p-7 transition-colors"
              >
                <div className="font-sora text-accent text-[36px] font-[700] leading-none">
                  {s.metric}
                </div>
                <div className="font-poppins text-muted-foreground mt-1 text-xs uppercase tracking-wider">
                  {s.metricLabel}
                </div>
                <blockquote className="font-poppins text-foreground mt-6 text-base leading-[26px]">
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <footer className="border-border mt-6 border-t pt-4">
                  <div className="font-poppins text-foreground text-sm font-[600]">
                    {s.person} · {s.company}
                  </div>
                  <div className="font-poppins text-muted-foreground mt-0.5 text-xs">
                    {s.sector}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-background pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="border-border bg-ink text-ink-foreground flex flex-col items-center justify-between gap-6 rounded-[20px] border px-8 py-10 md:flex-row md:px-12">
            <div>
              <h3 className="font-sora text-[22px] font-[700] md:text-[26px]">
                Want to be the next case study?
              </h3>
              <p className="font-poppins mt-2 text-sm text-white/70 md:text-base">
                Get in touch. We&apos;ll write it together once you&apos;re live.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/signup"
                className="font-poppins shadow-cta bg-accent inline-flex h-[44px] items-center rounded-[8px] px-5 text-sm font-[600] text-white"
              >
                Start free
              </Link>
              <Link
                href="/contact"
                className="font-poppins inline-flex h-[44px] items-center rounded-[8px] border border-white/20 bg-white/5 px-5 text-sm font-[500] text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
