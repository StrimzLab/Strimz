import { BoltIcon, CoinIcon, GlobeIcon, LockIcon } from './Icons'

const FEATURES = [
  {
    icon: BoltIcon,
    title: 'Instant payouts',
    body: 'The creator holds their tip the moment your signature confirms on-chain. No T+2, no delayed capture.',
  },
  {
    icon: CoinIcon,
    title: 'Real revenue',
    body: 'Stablecoin USDC. Not points, not credits, not a promise. What you send is what they can spend.',
  },
  {
    icon: GlobeIcon,
    title: 'Global by default',
    body: 'Fans in São Paulo, Lagos, Manila, Warsaw — same rail. Same experience. Same cost.',
  },
  {
    icon: LockIcon,
    title: 'Signed, not stored',
    body: 'You approve each charge with your wallet. Nothing gets kept on file. Cancel any time, no phone call.',
  },
] as const

export function FeaturesGrid() {
  return (
    <section id="how" className="border-t border-[hsl(var(--border))] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight md:text-4xl">
          Why creators are moving to Fanline
        </h2>
        <p className="muted mx-auto mt-4 max-w-2xl text-center leading-7">
          Every payout mechanic that Patreon, Ko-fi, and Substack force you into — chargebacks,
          holds, KYC delays — disappears when payments settle on a public ledger in seconds.
        </p>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card hover:border-brand-500/60 rounded-2xl p-6 transition">
              <div className="bg-brand-500/10 text-brand-500 inline-flex h-10 w-10 items-center justify-center rounded-full">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="muted mt-2 text-sm leading-6">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
