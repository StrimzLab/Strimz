import type { Metadata } from 'next'
import { LegalDoc } from '@/components/marketing/legal-doc'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Strimz collects, uses, and protects merchant and payer data. Wallet addresses, KYC, cookies, and your rights as a data subject.',
  alternates: { canonical: '/legal/privacy' },
  openGraph: { title: 'Privacy Policy · Strimz', url: '/legal/privacy', images: [OG_IMAGE] },
}

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'collect', label: 'Data we collect' },
  { id: 'not-collect', label: 'Data we never collect' },
  { id: 'use', label: 'How we use it' },
  { id: 'share', label: 'Data sharing' },
  { id: 'retention', label: 'Retention' },
  { id: 'rights', label: 'Your rights' },
  { id: 'children', label: 'Children' },
  { id: 'transfers', label: 'International transfers' },
  { id: 'security', label: 'Security' },
  { id: 'contact', label: 'Contact' },
]

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      description="What data Strimz collects, what we do with it, and the rights you have over it."
      effectiveDate="1 May 2026"
      lastUpdated="1 May 2026"
      toc={TOC}
    >
      <h2 id="overview">Overview</h2>
      <p>
        Strimz Labs Ltd. ("Strimz", "we") collects only the data needed to operate the Service —
        authenticate you, settle payments, and send you receipts and product communications. We do
        not sell personal data and we do not run third-party advertising on our surfaces.
      </p>
      <p>
        This policy applies to data we process about merchants who sign up at strimz.finance and
        about end-customers who pay through Strimz checkouts.
      </p>

      <h2 id="collect">Data we collect</h2>
      <p>
        <strong>From merchants:</strong>
      </p>
      <ul>
        <li>Name and email address (provided to Privy at sign-up).</li>
        <li>
          Business information you provide during onboarding (legal name, trading name, sector,
          country, registered address, tax ID).
        </li>
        <li>Payout wallet address.</li>
        <li>
          API keys you create (we store a SHA-256 hash and the prefix; the full secret is never
          persisted).
        </li>
        <li>Webhook endpoint URLs and signing secret hashes.</li>
        <li>Dashboard activity logs (which keys were created, who invited a teammate, etc.).</li>
        <li>Communication you send us via support channels.</li>
      </ul>
      <p>
        <strong>From end-customers paying via your Strimz checkout:</strong>
      </p>
      <ul>
        <li>Wallet address (visible on-chain).</li>
        <li>Email address (only if your checkout collects it).</li>
        <li>Payment metadata you pass through the SDK.</li>
      </ul>
      <p>
        We also collect technical information automatically: IP address, browser user agent, locale,
        and the URLs you visit on our marketing site. We use a self-hosted analytics setup that
        anonymises IP addresses at ingestion.
      </p>

      <h2 id="not-collect">Data we never collect</h2>
      <ul>
        <li>
          Private keys or seed phrases — wallet authentication is delegated to Privy and your wallet
          provider.
        </li>
        <li>
          Card numbers, bank account numbers, or tax-return data — Strimz does not handle
          traditional payment rails.
        </li>
        <li>
          Government-ID images for the Free / Starter tiers (live-mode unlocks via self-attested KYB
          + 2FA).
        </li>
      </ul>

      <h2 id="use">How we use it</h2>
      <p>We process your data to:</p>
      <ul>
        <li>Authenticate you and route requests to the correct merchant account.</li>
        <li>Settle and reconcile on-chain payments to your payout wallet.</li>
        <li>
          Send transactional email (account verification, recovery emails, daily digests, security
          alerts, invoice receipts).
        </li>
        <li>Detect and prevent abuse (rate-limit enforcement, leaked-key scanning).</li>
        <li>Comply with legal obligations and respond to lawful requests.</li>
      </ul>

      <h2 id="share">Data sharing</h2>
      <p>We share data only with infrastructure providers necessary to operate the Service:</p>
      <ul>
        <li>
          <strong>Privy</strong> — identity, embedded wallets, 2FA.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery.
        </li>
        <li>
          <strong>Cloudflare</strong> — bot protection (Turnstile) on signup and checkout.
        </li>
        <li>
          <strong>Render</strong> + <strong>Vercel</strong> — application hosting.
        </li>
        <li>
          <strong>Circle</strong> — CCTP V2 attestation API for cross-chain routing (only the
          source-chain transaction hash is shared, no personal data).
        </li>
        <li>
          <strong>TRM Labs / Elliptic</strong> — wallet sanctions screening when the compliance
          integration is enabled (wallet address only).
        </li>
      </ul>
      <p>
        We do not sell your data. We will disclose data when legally compelled (court order,
        subpoena), and we will notify you of any such request unless prohibited by law.
      </p>

      <h2 id="retention">Retention</h2>
      <p>
        We retain merchant data for as long as your account is active and for up to seven (7) years
        after closure to satisfy tax and accounting obligations. Webhook delivery logs are retained
        for ninety (90) days. On-chain data is, by nature of public blockchains, permanent.
      </p>

      <h2 id="rights">Your rights</h2>
      <p>Depending on where you are located, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate data.</li>
        <li>Request deletion (subject to legal retention obligations).</li>
        <li>Export your data in a machine-readable format.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Withdraw consent for marketing communications at any time.</li>
      </ul>
      <p>
        Exercise any of these by emailing{' '}
        <a href="mailto:privacy@strimz.finance">privacy@strimz.finance</a>. We respond to all
        requests within thirty (30) days.
      </p>

      <h2 id="children">Children</h2>
      <p>
        The Service is not directed at individuals under sixteen (16). We do not knowingly collect
        personal data from minors. If we learn we have, we will delete it.
      </p>

      <h2 id="transfers">International transfers</h2>
      <p>
        Our infrastructure providers operate globally. Where personal data is transferred outside
        the UK or EEA, we rely on Standard Contractual Clauses or equivalent safeguards.
      </p>

      <h2 id="security">Security</h2>
      <p>
        We use TLS in transit, encryption at rest for our managed databases, and per-merchant data
        partitioning. API keys and webhook signing secrets are stored only as SHA-256 hashes;
        secrets are returned exactly once at creation time and cannot be recovered. We follow a
        responsible disclosure policy at{' '}
        <a href="mailto:security@strimz.finance">security@strimz.finance</a>.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Strimz Labs Ltd., 20 Chancery Lane, London EC4A 1LF, United Kingdom.
        <br />
        <a href="mailto:privacy@strimz.finance">privacy@strimz.finance</a> for any privacy-related
        question.
      </p>
    </LegalDoc>
  )
}
