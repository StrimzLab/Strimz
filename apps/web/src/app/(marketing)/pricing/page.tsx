import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { cn } from '@strimz/ui'
import { AuroraBackground } from '@/components/effects/aurora-background'

const TIERS = [
  {
    name: 'Free',
    price: '0%',
    cap: 'First $1,000 in volume',
    cta: { href: '/signup', label: 'Start free' },
    features: [
      'All payment, subscription, refund, webhook & invoice APIs',
      'AI AutoPay Agent — recovery + cashflow digest',
      'Up to 1,000 webhook events / month',
      'Self-attested KYB + 2FA gate for live mode',
    ],
    excluded: ['Custom domains', 'Dedicated solutions engineer', 'SLA'],
  },
  {
    name: 'Starter',
    price: '0.5%',
    cap: 'Up to $50,000 / month',
    cta: { href: '/signup', label: 'Start with Starter' },
    featured: true,
    features: [
      'Everything in Free, no volume cap',
      'Cashflow anomaly detection + yield recommendations',
      'Storefront builder + custom branding',
      'Priority email support',
    ],
    excluded: ['Custom domains', 'Dedicated solutions engineer'],
  },
  {
    name: 'Growth',
    price: '0.4%',
    cap: 'Up to $1M / month',
    cta: { href: '/contact', label: 'Talk to sales' },
    features: [
      'Everything in Starter',
      'Custom domains for storefront + checkout',
      'Cross-chain settlement (CCTP V2)',
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
      'Custom AI agent capabilities',
      'On-premise indexer / scheduler deployments',
      '99.99% uptime SLA',
      'Custom legal terms',
    ],
    excluded: [],
  },
] as const

const COMPARISON_ROWS: ReadonlyArray<{
  label: string
  values: ReadonlyArray<string | boolean>
}> = [
  { label: 'Per-transaction fee', values: ['0%', '0.5%', '0.4%', 'Custom'] },
  { label: 'Volume cap', values: ['$1k total', '$50k / mo', '$1M / mo', 'Unlimited'] },
  { label: 'Free webhook events / month', values: ['1k', '50k', '500k', 'Unlimited'] },
  { label: 'AI AutoPay — recovery + digest', values: [true, true, true, true] },
  { label: 'AI AutoPay — anomaly + yield', values: [false, true, true, true] },
  { label: 'Cross-chain (CCTP V2)', values: [false, false, true, true] },
  { label: 'Custom domain checkout', values: [false, false, true, true] },
  { label: 'Priority support', values: [false, true, true, true] },
  { label: 'SLA', values: ['—', '—', '99.9%', '99.99%'] },
  { label: 'Dedicated solutions engineer', values: [false, false, false, true] },
]

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/40">
        <AuroraBackground variant="bold" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h1 className="text-balance font-poppins text-4xl font-bold tracking-tight sm:text-6xl">
            Pay only on what you process.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
            No platform fees. No hidden tiers. Volume scales you down — not up.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={cn(
                'flex flex-col rounded-xl border p-6 transition-all',
                t.featured
                  ? 'strimz-card-shadow border-[#02C76A] bg-background ring-1 ring-[#02C76A]'
                  : 'border-border/60 bg-background',
              )}
            >
              {t.featured && (
                <Badge className="mb-3 self-start bg-[#02C76A] text-white hover:bg-[#02C76A]">Most popular</Badge>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.name}</div>
              <div className="mt-2 font-sora text-4xl font-bold">{t.price}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.cap}</div>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#02C76A]" />
                    <span>{f}</span>
                  </li>
                ))}
                {t.excluded.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted-foreground/70">
                    <X className="mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={t.cta.href}
                className={cn(
                  'mt-6 inline-flex h-10 items-center justify-center rounded-md text-sm font-medium transition-transform hover:scale-[1.02]',
                  t.featured
                    ? 'strimz-cta-shadow bg-[#02C76A] text-white'
                    : 'border border-border bg-background',
                )}
              >
                {t.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <h2 className="mt-24 text-center font-poppins text-2xl font-semibold tracking-tight sm:text-3xl">
          Compare every plan
        </h2>
        <div className="strimz-card-shadow mt-8 overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                {TIERS.map((t) => (
                  <th key={t.name} className="px-4 py-3 text-left font-medium">{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-border/40">
                  <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-3">
                      {typeof v === 'boolean' ? (
                        v ? (
                          <Check className="size-4 text-[#02C76A]" />
                        ) : (
                          <X className="size-4 text-muted-foreground/40" />
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
      </section>
    </>
  )
}
