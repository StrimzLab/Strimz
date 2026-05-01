export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
        <p>
          Strimz collects only the data necessary to operate the Service: your email address,
          business name, country code, and the on-chain wallet addresses you've authorised.
        </p>
        <h2>What we do not collect</h2>
        <p>
          We never collect or store private keys, seed phrases, or wallet credentials. Authentication
          is handled by Privy; the merchant secret-key authentication is handled via SHA-256 hashing
          on the server side.
        </p>
        <h2>Data sharing</h2>
        <p>
          We share data with: Privy (auth), Resend (transactional email), Cloudflare (bot
          protection), and our infrastructure providers (Render, Vercel). We do not sell user data.
        </p>
        <h2>Your rights</h2>
        <p>
          You can export, modify, or delete your data at any time via the Strimz dashboard or by
          emailing privacy@strimz.io.
        </p>
      </div>
    </article>
  )
}
