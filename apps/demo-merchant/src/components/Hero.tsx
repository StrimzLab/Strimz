import { ArrowRightIcon } from './Icons'

export function Hero() {
  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="muted inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs">
            <span className="bg-brand-500 h-1.5 w-1.5 rounded-full" />
            Now live — creator payouts in USDC, no invoicing.
          </span>
          <h1 className="font-display mt-6 text-5xl font-semibold tracking-tight md:text-6xl">
            Support the creators you love.
            <span className="from-brand-500 via-brand-400 mt-2 block bg-gradient-to-r to-purple-400 bg-clip-text text-transparent">
              Paid in stablecoins.
            </span>
          </h1>
          <p className="muted mx-auto mt-6 max-w-xl text-lg leading-8">
            Fanline turns your one-off tips and monthly subscriptions into real revenue that lands
            in the creator&rsquo;s wallet the moment you sign. No middleman fees. No chargebacks.
            Just a receipt.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="#creators"
              className="bg-brand-500 hover:bg-brand-600 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              Send a tip
              <ArrowRightIcon className="h-4 w-4" />
            </a>
            <a
              href="#pro"
              className="hover:border-brand-500 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-3 text-sm font-semibold text-[hsl(var(--fg))] transition"
            >
              Go Pro — $9.99/mo
            </a>
          </div>
          <p className="muted mt-4 text-xs">
            Powered by <span className="font-medium">Strimz</span> — settlement in ~13 seconds on
            Arc.
          </p>
        </div>
      </div>
    </section>
  )
}
