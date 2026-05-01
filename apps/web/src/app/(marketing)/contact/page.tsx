import { Badge } from '@strimz/ui'

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <Badge variant="outline" className="mb-4">Contact</Badge>
      <h1 className="text-balance font-poppins text-4xl font-bold tracking-tight sm:text-5xl">
        Get in touch.
      </h1>
      <p className="mt-4 text-muted-foreground">
        We answer every email.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { addr: 'sales@strimz.io', label: 'Sales' },
          { addr: 'support@strimz.io', label: 'Support' },
          { addr: 'security@strimz.io', label: 'Security' },
        ].map((l) => (
          <a
            key={l.addr}
            href={`mailto:${l.addr}`}
            className="strimz-card-shadow rounded-lg border border-border/60 bg-background p-5 transition-colors hover:border-[#02C76A]/40"
          >
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {l.label}
            </div>
            <div className="mt-1 font-mono text-sm">{l.addr}</div>
          </a>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border/60 bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">
          Looking for a Slack channel + dedicated solutions engineer? That ships with the Growth
          and Enterprise plans.{' '}
          <a href="/pricing" className="font-medium text-foreground hover:underline">
            See plans →
          </a>
        </p>
      </div>
    </section>
  )
}
