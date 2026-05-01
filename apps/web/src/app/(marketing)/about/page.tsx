import { Badge } from '@strimz/ui'
import { AuroraBackground } from '@/components/effects/aurora-background'

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/40">
        <AuroraBackground variant="soft" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <Badge variant="outline" className="mb-4">About</Badge>
          <h1 className="text-balance font-poppins text-4xl font-bold tracking-tight sm:text-5xl">
            Billing infrastructure, finally rebuilt for stablecoins.
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p>
            Strimz is what happens when you take everything Stripe taught us about
            developer-experience and rebuild the billing primitive on chains where money is
            programmable, settlement is instant, and the customer can verify every transaction
            themselves.
          </p>
          <p>
            We're built on Arc — Circle's stablecoin-native L1 where USDC is the gas token. That
            means your customer never needs to hold ETH, never needs to top up gas, and never sees
            a "transaction failed because gas spiked" page. Just stablecoins, in and out.
          </p>
          <p>
            Strimz is open about its architecture. The smart contracts are upgradeable but
            UUPS-namespaced (no storage collisions ever). The indexer is a Go process any customer
            can re-run independently to re-derive their own data. The AI AutoPay Agent is a
            process you can audit per-line.
          </p>
          <p>
            Everything is in monorepo at{' '}
            <a href="https://github.com/StrimzLab/strimz">github.com/StrimzLab/strimz</a>.
          </p>
        </div>
      </section>
    </>
  )
}
