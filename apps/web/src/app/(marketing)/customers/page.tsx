import type { Metadata } from 'next'
import Link from 'next/link'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Customers',
  description:
    'Built for SaaS, AI products, marketplaces, and creator platforms that want to bill in stablecoins on Arc.',
  openGraph: {
    title: 'Customers · Strimz',
    description:
      'See how SaaS, AI, marketplace, and creator businesses use Strimz to bill in USDC on Arc.',
    url: '/customers',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/customers' },
}

interface Testimonial {
  quote: string
  name: string | null
  role: string | null
  company: string | null
  sector: string
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "Our subscribers pay in USDC now, and the money lands in our own wallet the moment it settles. There's no payout schedule to wait on. Setting up the first plan was quicker than I expected.",
    name: null,
    role: null,
    company: null,
    sector: 'SaaS',
  },
  {
    quote:
      'Customers sign once and the monthly charge just happens. When a charge fails we get a webhook and they get an email asking them to top up. I stopped chasing people by hand.',
    name: null,
    role: null,
    company: null,
    sector: 'Subscriptions',
  },
  {
    quote:
      'The webhooks are signed, so our order system trusts them without us polling anything. And our customers never have to buy gas to pay us, which used to be the first question they asked.',
    name: null,
    role: null,
    company: null,
    sector: 'Marketplace',
  },
]

const NAMED_TESTIMONIALS = TESTIMONIALS.filter((t) => t.name && t.role && t.company)

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
            Built for teams who bill online.
          </h1>
          <p className="font-poppins text-muted-foreground mt-5 max-w-2xl text-base font-[400] leading-[28px]">
            Strimz is for teams whose billing is too complex for a spreadsheet, too early for a
            full-time finance engineer, and too important to hand off to someone else.
          </p>
        </div>
      </section>

      {NAMED_TESTIMONIALS.length > 0 && (
        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-sora text-foreground text-center text-[32px] font-[700] leading-[40px] md:text-[40px] md:leading-[48px]">
              What teams on Strimz say.
            </h2>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {NAMED_TESTIMONIALS.map((t) => (
                <article
                  key={t.name}
                  className="border-border bg-muted hover:border-accent/40 rounded-[16px] border p-7 transition-colors"
                >
                  <blockquote className="font-poppins text-foreground text-base leading-[26px]">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <footer className="border-border mt-6 border-t pt-4">
                    <div className="font-poppins text-foreground text-sm font-[600]">{t.name}</div>
                    <div className="font-poppins text-muted-foreground mt-0.5 text-xs">
                      {t.role}, {t.company} · {t.sector}
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA strip */}
      <section className="bg-background pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="border-border bg-ink text-ink-foreground flex flex-col items-center justify-between gap-6 rounded-[20px] border px-8 py-10 md:flex-row md:px-12">
            <div>
              <h3 className="font-sora text-[22px] font-[700] md:text-[26px]">
                Want to be our first case study?
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
