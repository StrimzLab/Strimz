import { Badge, Card, CardContent } from '@strimz/ui'
import { AuroraBackground } from '@/components/effects/aurora-background'

const STORIES = [
  {
    name: 'Mercato',
    metric: '+2.4% net margin',
    quote:
      'We replaced a Stripe + manual reconciliation pipeline with Strimz in three days. Net margin on subscription revenue went up 240 basis points.',
    person: 'CFO, Mercato',
  },
  {
    name: 'Aperture',
    metric: '4 hours → 0 outage',
    quote:
      'The AutoPay Agent caught a billing anomaly two hours before our on-call would have. Saved us a four-hour outage.',
    person: 'Eng lead, Aperture',
  },
  {
    name: 'Hexcell',
    metric: 'Weekend launch',
    quote:
      "We launched USDC subscriptions in a weekend. Customers love that they don't pay gas — we'd never get that with USDC on Ethereum mainnet.",
    person: 'Founder, Hexcell',
  },
] as const

export default function CustomersPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/40">
        <AuroraBackground variant="soft" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <Badge variant="outline" className="mb-4">Customers</Badge>
          <h1 className="text-balance font-poppins text-4xl font-bold tracking-tight sm:text-5xl">
            Teams shipping the next wave of stablecoin commerce.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Builders use Strimz when their billing surface is too complex for spreadsheets and too
            early for a full-time finance engineer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((s) => (
            <Card key={s.name} className="strimz-card-shadow border-border/60">
              <CardContent className="p-6">
                <div className="font-sora text-2xl font-bold tracking-tight text-[#02C76A]">{s.metric}</div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">"{s.quote}"</p>
                <p className="mt-4 text-xs font-medium">— {s.person}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}
