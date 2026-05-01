export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
        <p>
          By accessing or using Strimz services (the "Service"), you agree to be bound by these
          Terms. If you are entering this agreement on behalf of a company, you represent that
          you have the authority to bind that entity.
        </p>
        <h2>1. The Service</h2>
        <p>
          Strimz provides infrastructure for accepting, managing, and settling stablecoin
          payments on the Arc blockchain. We are not a custodian of your funds; settlements
          flow directly to the wallet address you configure as your payout address.
        </p>
        <h2>2. Fees</h2>
        <p>
          Per-transaction fees are calculated on every payment processed through the Service at
          the rate associated with your active plan. Fees are deducted on-chain at settlement
          time and recorded in the on-chain fee ledger.
        </p>
        <h2>3. Acceptable use</h2>
        <p>
          Your use of the Service must comply with our acceptable use policy and all applicable
          laws including, where relevant, sanctions and anti-money-laundering regulations.
        </p>
        <h2>4. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Strimz is not liable for any indirect,
          incidental, special, or consequential damages.
        </p>
      </div>
    </article>
  )
}
