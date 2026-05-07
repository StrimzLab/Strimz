import Link from 'next/link'
import { Coins, Lock, ShieldCheck, Zap } from 'lucide-react'

const PRINCIPLES = [
  {
    icon: Coins,
    title: 'Stablecoins first, not bolted on',
    body: 'The whole platform was designed for on-chain settlement on day one. Nothing has been grafted onto a card-rails product to make this work.',
  },
  {
    icon: Zap,
    title: 'Settlement in seconds, not days',
    body: 'When a customer pays, the money is in your wallet within seconds. No three-day clearing window. No reversal risk.',
  },
  {
    icon: Lock,
    title: 'You hold your money, not us',
    body: 'Strimz is non-custodial. Payments settle directly into a wallet you control. There is no balance you have to wait to withdraw.',
  },
  {
    icon: ShieldCheck,
    title: 'Verifiable end to end',
    body: 'Every payment is on-chain. You can verify any transaction independently — without needing to trust our database, our team, or anyone else.',
  },
] as const

const NUMBERS = [
  { value: '~13s', label: 'Median settlement' },
  { value: '6', label: 'Chains we accept payments from' },
  { value: '99.97%', label: 'Webhook success' },
  { value: '0', label: 'Funds we hold for you' },
] as const

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div
          className="strimz-wave-1 absolute inset-x-0 -top-32 mx-auto h-[400px] max-w-3xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <span className="font-poppins inline-flex items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-3 py-1 text-[12px] font-[600] text-[#02C76A]">
            <span className="size-1.5 rounded-full bg-[#02C76A]" />
            About
          </span>
          <h1 className="font-sora mt-5 text-[40px] font-[700] leading-[48px] text-[#050020] md:text-[56px] md:leading-[60px]">
            Billing, designed for stablecoins.
          </h1>
          <p className="font-poppins mx-auto mt-5 max-w-2xl text-base font-[400] leading-[28px] text-[#58556A]">
            Strimz is a billing platform for businesses that want to take payments in stablecoins.
            We handle the parts you would otherwise have to build yourself: hosted checkout,
            recurring subscriptions, refunds, payouts, and a real audit trail.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white py-16">
        <div className="font-poppins mx-auto max-w-3xl space-y-6 px-4 text-base leading-[28px] text-[#58556A] sm:px-6">
          <p>
            We started Strimz because the existing options for taking stablecoin payments are either
            too complex (a wallet plus a manual reconciliation script) or too consumer (built for
            individuals sending money to each other, not businesses billing customers).
          </p>
          <p>
            Businesses need the same primitives card processors gave them years ago: subscriptions
            that don&apos;t fail silently, refunds with a clear paper trail, webhooks that retry on
            their own, and a dashboard you can hand to a finance team. We think those should work
            the same when the money is USDC — and the on-chain settlement should make a few of them
            better.
          </p>
          <p>
            Everything we build is anchored to that. Take payments fast. Settle fast. Give the
            customer something they can verify themselves.
          </p>
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-[#050020] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:gap-x-6">
            {NUMBERS.map((n) => (
              <div key={n.label} className="text-center sm:text-left">
                <div className="font-sora text-[32px] font-[700] leading-none tracking-[-0.02em] text-white sm:text-[40px]">
                  {n.value}
                </div>
                <div className="font-poppins mt-2 text-[12px] font-[400] uppercase tracking-[0.18em] text-white/60">
                  {n.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-[#F9FAFB] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-sora text-[32px] font-[700] leading-[40px] text-[#050020] md:text-[40px] md:leading-[48px]">
              What we believe
            </h2>
            <p className="font-poppins mt-4 text-base text-[#58556A]">
              Four ideas that shape every product decision we make.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <article
                key={p.title}
                className="shadow-sub-card rounded-[16px] border border-[#E5E7EB] bg-white p-6 transition-colors hover:border-[#02C76A]/40"
              >
                <span className="shadow-sub-icon inline-flex size-10 items-center justify-center rounded-[10px] bg-[#02C76A]/10 text-[#02C76A]">
                  <p.icon className="size-5" />
                </span>
                <h3 className="font-sora mt-5 text-[20px] font-[700] text-[#050020]">{p.title}</h3>
                <p className="font-poppins mt-2 text-sm leading-[24px] text-[#58556A]">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Team + CTA */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h3 className="font-sora text-[24px] font-[700] text-[#050020] md:text-[28px]">
            A small team, across London and Lagos.
          </h3>
          <p className="font-poppins mt-3 text-base text-[#58556A]">
            We&apos;re hiring engineers who have built billing systems before, and security people
            who like breaking them. If that sounds like you, please reach out.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="font-poppins shadow-cta inline-flex h-[44px] items-center rounded-[8px] bg-[#02C76A] px-5 text-sm font-[600] text-white transition-transform hover:scale-[1.02]"
            >
              Start free
            </Link>
            <Link
              href="/contact"
              className="font-poppins inline-flex h-[44px] items-center rounded-[8px] border border-[#E5E7EB] bg-white px-5 text-sm font-[500] text-[#050020] hover:border-[#050020]"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
