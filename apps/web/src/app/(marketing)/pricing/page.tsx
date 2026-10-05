import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Strimz pricing. Pay-as-you-go fees with no monthly minimums. Volume tiers down to 0.5%, no FX, no chargebacks. Free for the first $10K processed.',
  openGraph: {
    title: 'Pricing · Strimz',
    description:
      'Pay-as-you-go stablecoin billing. Volume tiers, no monthly minimums, no FX, no chargebacks.',
    url: '/pricing',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/pricing' },
}

type Tier = {
  name: string
  price: string
  cap: string
  cta: { href: string; label: string }
  featured?: boolean
  features: readonly string[]
  excluded: readonly string[]
}

const TIERS: readonly Tier[] = [
  {
    name: 'Free',
    price: '0%',
    cap: 'First $1,000 in volume',
    cta: { href: '/signup', label: 'Start free' },
    features: [
      'One-time payments and subscriptions',
      'Refunds, invoices, and webhooks',
      'Automated billing recovery emails',
      'Daily cashflow summary',
    ],
    excluded: ['Custom domains', 'Dedicated support', 'Uptime SLA'],
  },
  {
    name: 'Starter',
    price: '0.5%',
    cap: 'Up to $50,000 / month',
    cta: { href: '/signup', label: 'Start with Starter' },
    featured: true,
    features: [
      'Everything in Free, no volume cap',
      'Cashflow anomaly alerts',
      'Branded storefront builder',
      'Priority email support',
    ],
    excluded: ['Custom domains', 'Dedicated support'],
  },
  {
    name: 'Growth',
    price: '0.4%',
    cap: 'Up to $1M / month',
    cta: { href: '/contact', label: 'Talk to sales' },
    features: [
      'Everything in Starter',
      'Custom domain for storefront and checkout',
      'Accept payments from any USDC chain',
      'Dedicated Slack channel',
      '99.9% uptime SLA',
    ],
    excluded: ['Dedicated solutions engineer'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cap: 'Unlimited volume',
    cta: { href: '/contact', label: 'Contact sales' },
    features: [
      'Everything in Growth',
      'Dedicated solutions engineer',
      'Custom AI agent workflows',
      '99.99% uptime SLA',
      'Custom legal terms',
    ],
    excluded: [],
  },
]

const COMPARISON_ROWS: ReadonlyArray<{
  label: string
  values: ReadonlyArray<string | boolean>
}> = [
  { label: 'Per-transaction fee', values: ['0%', '0.5%', '0.4%', 'Custom'] },
  { label: 'Volume cap', values: ['$1k total', '$50k / mo', '$1M / mo', 'Unlimited'] },
  { label: 'Webhook events / month', values: ['1k', '50k', '500k', 'Unlimited'] },
  { label: 'Recovery emails + cashflow digest', values: [true, true, true, true] },
  { label: 'Anomaly alerts + yield recommendations', values: [false, true, true, true] },
  { label: 'Accept payments from any USDC chain', values: [false, false, true, true] },
  { label: 'Custom domain for checkout', values: [false, false, true, true] },
  { label: 'Priority support', values: [false, true, true, true] },
  { label: 'Uptime SLA', values: [', ', ', ', '99.9%', '99.99%'] },
  { label: 'Dedicated solutions engineer', values: [false, false, false, true] },
]

export default function PricingPage() {
  return (
    <>
      {/* Hero band */}
      <section className="bg-background relative overflow-hidden">
        <div
          className="strimz-wave-1 absolute inset-x-0 -top-40 mx-auto h-[400px] max-w-3xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <span className="font-poppins bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-[600]">
            <span className="bg-accent size-1.5 rounded-full" />
            Pricing
          </span>
          <h1 className="font-sora text-foreground mt-5 text-[40px] font-[700] leading-[48px] md:text-[60px] md:leading-[64px]">
            Pay only for what you process.
          </h1>
          <p className="font-poppins text-muted-foreground mx-auto mt-4 max-w-2xl text-base font-[400] leading-[28px]">
            A small percentage on each transaction. The more volume you do, the lower the rate. No
            platform fees on top, no hidden tiers. The fee is taken in the same transaction, so what
            you see is what lands in your wallet.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={[
                'bg-card flex flex-col rounded-[16px] p-6 transition-all',
                t.featured
                  ? 'shadow-sub-card border-accent ring-accent/10 border-2 ring-4'
                  : 'border-border border',
              ].join(' ')}
            >
              {t.featured ? (
                <span className="font-poppins bg-accent mb-3 self-start rounded-full px-2.5 py-0.5 text-[11px] font-[600] text-white">
                  Most popular
                </span>
              ) : null}
              <div className="font-poppins text-muted-foreground text-[13px] font-[500]">
                {t.name}
              </div>
              <div className="font-sora text-foreground mt-2 text-[40px] font-[700] leading-none">
                {t.price}
              </div>
              <div className="font-poppins text-muted-foreground mt-1 text-[11px]">{t.cap}</div>
              <ul className="font-poppins mt-6 flex-1 space-y-2.5 text-[13px]">
                {t.features.map((f) => (
                  <li key={f} className="text-foreground flex items-start gap-2">
                    <Check className="text-accent mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
                {t.excluded.map((f) => (
                  <li key={f} className="text-muted-foreground/60 flex items-start gap-2">
                    <X className="mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={t.cta.href}
                className={[
                  'font-poppins mt-6 inline-flex h-[44px] items-center justify-center rounded-[8px] text-[14px] font-[500] transition-transform hover:scale-[1.02]',
                  t.featured
                    ? 'shadow-cta bg-accent text-white'
                    : 'border-border bg-card text-foreground hover:border-primary border',
                ].join(' ')}
              >
                {t.cta.label}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <h2 className="font-sora text-foreground mt-24 text-center text-[28px] font-[700] tracking-tight md:text-[32px]">
          Compare every plan
        </h2>
        <div className="shadow-sub-card border-border bg-card mt-8 overflow-x-auto rounded-[16px] border">
          <table className="font-poppins w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-foreground px-5 py-4 text-left font-[600]">Feature</th>
                {TIERS.map((t) => (
                  <th key={t.name} className="text-foreground px-5 py-4 text-left font-[600]">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-border border-t">
                  <td className="text-muted-foreground px-5 py-3.5">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="text-foreground px-5 py-3.5">
                      {typeof v === 'boolean' ? (
                        v ? (
                          <Check className="text-accent size-4" />
                        ) : (
                          <X className="text-muted-foreground/40 size-4" />
                        )
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Closing band */}
        <div className="border-border bg-muted mt-16 rounded-[16px] border p-8 text-center">
          <h3 className="font-sora text-foreground text-[20px] font-[700] md:text-[24px]">
            Need something the plans don&apos;t cover?
          </h3>
          <p className="font-poppins text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            Custom workflows, dedicated regions, custom SLAs, custom legal terms. These all come
            with Enterprise. Tell us what you need.
          </p>
          <Link
            href="/contact"
            className="font-poppins bg-primary text-primary-foreground mt-5 inline-flex h-[44px] items-center rounded-[8px] px-5 text-[14px] font-[500] transition-transform hover:scale-[1.02]"
          >
            Talk to sales
          </Link>
        </div>
      </section>
    </>
  )
}
