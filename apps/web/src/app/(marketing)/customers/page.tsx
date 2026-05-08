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
      <section className="relative overflow-hidden bg-white">
        <div
          className="strimz-wave-2 absolute inset-x-0 -top-40 mx-auto h-[420px] max-w-3xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:py-28">
          <span className="font-poppins inline-flex items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-3 py-1 text-[12px] font-[600] text-[#02C76A]">
            <span className="size-1.5 rounded-full bg-[#02C76A]" />
            Customers
          </span>
          <h1 className="font-sora mt-5 max-w-3xl text-[40px] font-[700] leading-[48px] text-[#050020] md:text-[56px] md:leading-[60px]">
            Teams already running stablecoin billing on Strimz.
          </h1>
          <p className="font-poppins mt-5 max-w-2xl text-base font-[400] leading-[28px] text-[#58556A]">
            Builders pick Strimz when their billing is too complex for a spreadsheet, too early for
            a full-time finance engineer, and too important to hand off to someone else.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6 border-t border-[#E5E7EB] pt-10 lg:grid-cols-4">
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <div className="font-sora text-[28px] font-[700] text-[#050020] md:text-[32px]">
                  {s.value}
                </div>
                <div className="font-poppins mt-1 text-xs uppercase tracking-widest text-[#58556A]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="bg-[#F9FAFB] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-poppins text-center text-[11px] font-[500] uppercase tracking-[0.22em] text-[#58556A]">
            Some of the teams using Strimz today
          </p>
          <div className="mt-8 grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
            {LOGOS.map((n) => (
              <div
                key={n}
                className="font-sora flex items-center justify-center text-base font-[600] tracking-tight text-[#58556A]/70 transition-colors hover:text-[#050020]"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-sora text-center text-[32px] font-[700] leading-[40px] text-[#050020] md:text-[40px] md:leading-[48px]">
            What customers are seeing in production.
          </h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {STORIES.map((s) => (
              <article
                key={s.name}
                className="rounded-[16px] border border-[#E5E7EB] bg-[#F9FAFB] p-7 transition-colors hover:border-[#02C76A]/40"
              >
                <div className="font-sora text-[36px] font-[700] leading-none text-[#02C76A]">
                  {s.metric}
                </div>
                <div className="font-poppins mt-1 text-xs uppercase tracking-wider text-[#58556A]">
                  {s.metricLabel}
                </div>
                <blockquote className="font-poppins mt-6 text-base leading-[26px] text-[#050020]">
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
                <footer className="mt-6 border-t border-[#E5E7EB] pt-4">
                  <div className="font-poppins text-sm font-[600] text-[#050020]">
                    {s.person} · {s.company}
                  </div>
                  <div className="font-poppins mt-0.5 text-xs text-[#58556A]">{s.sector}</div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-white pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 rounded-[20px] border border-[#E5E7EB] bg-[#050020] px-8 py-10 text-white md:flex-row md:px-12">
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
                className="font-poppins shadow-cta inline-flex h-[44px] items-center rounded-[8px] bg-[#02C76A] px-5 text-sm font-[600] text-white"
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
