import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { OG_IMAGE } from '@/lib/seo'
import { PLAN_COMPARISON, PRICING_PLANS } from '@/lib/pricing-plans'

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
            Every merchant starts on Free, at 0% on the first $1,000 processed. As your all-time
            volume grows, your plan moves up automatically, and it never moves back. Volume counts
            per currency: 1,000 USDC or 1,000 EURC. The fee is taken in the same transaction, so
            what you see is what lands in your wallet.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {PRICING_PLANS.map((t) => (
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
                  Recommended
                </span>
              ) : null}
              <div className="font-poppins text-muted-foreground text-[13px] font-[500]">
                {t.name}
              </div>
              <div className="font-sora text-foreground mt-2 text-[40px] font-[700] leading-none">
                {t.price}
              </div>
              <div className="font-poppins text-muted-foreground mt-1 text-[11px]">
                {t.threshold}
              </div>
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
                {PRICING_PLANS.map((t) => (
                  <th key={t.name} className="text-foreground px-5 py-4 text-left font-[600]">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
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
            Need a custom rate?
          </h3>
          <p className="font-poppins text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            Enterprise pricing is set by contract. Tell us about your volume and we will come back
            with a rate.
          </p>
          <Link
            href="/contact"
            className="font-poppins bg-primary text-primary-foreground mt-5 inline-flex h-[44px] items-center rounded-[8px] px-5 text-[14px] font-[500] transition-transform hover:scale-[1.02]"
          >
            Contact us
          </Link>
        </div>
      </section>
    </>
  )
}
