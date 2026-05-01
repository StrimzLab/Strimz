export default function AcceptableUsePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Acceptable Use Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
        <p>
          You may not use Strimz for any business that involves: sanctioned entities or
          jurisdictions, child exploitation, weapons trafficking, narcotics trafficking, money
          laundering, terrorism financing, or pyramid / ponzi schemes.
        </p>
        <h2>Compliance screening</h2>
        <p>
          When the compliance integration is enabled, every payer wallet is screened against TRM
          Labs / Elliptic at checkout time. Wallets above the configured risk threshold are
          rejected and the merchant is notified.
        </p>
        <h2>Reporting</h2>
        <p>
          Suspected misuse can be reported to abuse@strimz.io. We respond to all reports within
          24 business hours.
        </p>
      </div>
    </article>
  )
}
