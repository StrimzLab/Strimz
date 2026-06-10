import type { Metadata } from 'next'
import { LegalDoc } from '@/components/marketing/legal-doc'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description:
    'Categories of business and behaviour permitted on Strimz, and the activities prohibited under the Acceptable Use Policy.',
  alternates: { canonical: '/legal/acceptable-use' },
  openGraph: {
    title: 'Acceptable Use Policy · Strimz',
    url: '/legal/acceptable-use',
    images: [OG_IMAGE],
  },
}

const TOC = [
  { id: 'principles', label: 'Principles' },
  { id: 'prohibited', label: 'Prohibited businesses' },
  { id: 'restricted', label: 'Restricted businesses' },
  { id: 'screening', label: 'Compliance screening' },
  { id: 'misuse', label: 'Reporting misuse' },
  { id: 'enforcement', label: 'Enforcement' },
]

export default function AcceptableUsePage() {
  return (
    <LegalDoc
      title="Acceptable Use Policy"
      description="What you can and cannot do with Strimz. Violations may result in account suspension, key revocation, or termination."
      effectiveDate="1 May 2026"
      lastUpdated="1 May 2026"
      toc={TOC}
    >
      <h2 id="principles">Principles</h2>
      <p>
        Strimz exists to make legitimate stablecoin commerce easier. We operate in a permissionless
        on-chain environment, but the Service we provide — the API, dashboard, hosted checkout,
        webhook delivery, and the AutoPay Agent — is not. The activities listed below are prohibited
        from running on Strimz infrastructure.
      </p>
      <p>
        These rules apply equally to test mode and live mode. They apply regardless of whether the
        customer pays directly to your wallet on-chain or via Strimz's hosted checkout.
      </p>

      <h2 id="prohibited">Prohibited businesses</h2>
      <p>You may not use Strimz for any business or activity that involves:</p>
      <ul>
        <li>
          <strong>Sanctioned entities or jurisdictions</strong> (e.g., OFAC SDN, EU consolidated
          list, UK HMT financial-sanctions list).
        </li>
        <li>
          <strong>Child sexual abuse material</strong> or any content sexualising minors.
        </li>
        <li>
          <strong>Human trafficking</strong> or forced labour.
        </li>
        <li>
          <strong>Weapons trafficking</strong>, including firearms, ammunition, and dual-use goods
          controlled under export law.
        </li>
        <li>
          <strong>Narcotics</strong> trafficking or sale.
        </li>
        <li>
          <strong>Money laundering</strong>, terrorism financing, or evasion of capital controls.
        </li>
        <li>
          <strong>Pyramid, ponzi, multi-level-marketing, or matrix schemes.</strong>
        </li>
        <li>
          <strong>Unregistered securities offerings</strong>, manipulative market practices, or wash
          trading.
        </li>
        <li>
          <strong>Mixing or tumbling services</strong> intended to obscure the origin of funds.
        </li>
        <li>
          <strong>Phishing, malware distribution, or credential harvesting.</strong>
        </li>
      </ul>

      <h2 id="restricted">Restricted businesses</h2>
      <p>
        The following sectors are not prohibited but require explicit pre-approval. Operating in
        these sectors without notifying us is a breach of this policy.
      </p>
      <ul>
        <li>Online gambling, sports betting, and games of chance.</li>
        <li>Adult content or services.</li>
        <li>Money-transmitter / VASP businesses (you may need your own licence).</li>
        <li>High-risk consumer credit products.</li>
        <li>Pharmaceuticals, including telemedicine prescriptions.</li>
        <li>Charities operating in jurisdictions with elevated diversion risk.</li>
      </ul>
      <p>
        If you operate in one of these sectors, contact{' '}
        <a href="mailto:compliance@strimz.finance">compliance@strimz.finance</a> before launching.
      </p>

      <h2 id="screening">Compliance screening</h2>
      <p>
        When the compliance integration is enabled, every payer wallet is screened against TRM Labs
        / Elliptic at checkout time. Wallets above the configured risk threshold are rejected and
        you are notified via your AutoPay Agent activity log.
      </p>
      <p>
        Strimz reserves the right to enable mandatory screening for any merchant we have reasonable
        grounds to believe is exposed to elevated counterparty risk. We will notify you in advance
        whenever this happens.
      </p>

      <h2 id="misuse">Reporting misuse</h2>
      <p>
        Suspected misuse can be reported to{' '}
        <a href="mailto:abuse@strimz.finance">abuse@strimz.finance</a>. Include the storefront URL,
        transaction hash, or merchant ID where relevant. We acknowledge every report within
        twenty-four (24) business hours and investigate independently.
      </p>

      <h2 id="enforcement">Enforcement</h2>
      <p>
        If we determine in good faith that an account has violated this policy, we may take any of
        the following actions, individually or together:
      </p>
      <ul>
        <li>Disable specific webhook endpoints or storefronts.</li>
        <li>Revoke API keys and disable live mode.</li>
        <li>Pause the AutoPay Agent for the affected account.</li>
        <li>Terminate the account under section 11 of the Terms of Service.</li>
        <li>Report to law-enforcement or regulatory authorities where legally required.</li>
      </ul>
      <p>
        Strimz is not a custodian. Funds settled to your payout wallet remain in your control
        on-chain regardless of any action we take against your dashboard account.
      </p>
    </LegalDoc>
  )
}
