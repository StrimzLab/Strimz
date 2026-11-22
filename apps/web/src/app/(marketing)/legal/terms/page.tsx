import type { Metadata } from 'next'
import { LegalDoc } from '@/components/marketing/legal-doc'
import { TERMS_VERSION } from '@strimz/shared-config'
import { OG_IMAGE } from '@strimz/web-shared/lib/seo'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Strimz Terms of Service. The agreement between STRIMZ LTD and the businesses that use Strimz.',
  alternates: { canonical: '/legal/terms' },
  openGraph: { title: 'Terms of Service · Strimz', url: '/legal/terms', images: [OG_IMAGE] },
}

const TOC = [
  { id: 'who', label: '1. Who we are' },
  { id: 'agreement', label: '2. This agreement' },
  { id: 'service', label: '3. What Strimz does' },
  { id: 'account', label: '4. Your account' },
  { id: 'fees', label: '5. Fees' },
  { id: 'network-fees', label: '6. Network fees' },
  { id: 'payments', label: '7. Payments and refunds' },
  { id: 'use', label: '8. How you may use Strimz' },
  { id: 'data', label: '9. Data and privacy' },
  { id: 'availability', label: '10. Availability and risks' },
  { id: 'liability', label: '11. Liability' },
  { id: 'suspension', label: '12. Suspension and closing' },
  { id: 'changes', label: '13. Changes to these terms' },
  { id: 'notices', label: '14. Notices and contact' },
  { id: 'law', label: '15. Law and disputes' },
]

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      description={`The agreement between your business and STRIMZ LTD for using Strimz. Version ${TERMS_VERSION}.`}
      effectiveDate="22 November 2026"
      lastUpdated="22 November 2026"
      toc={TOC}
    >
      <h2 id="who">1. Who we are</h2>
      <p>
        Strimz is run by STRIMZ LTD, a private company limited by shares, registered in Nigeria
        under the Companies and Allied Matters Act 2020 with registration number RC 8624034. In
        these terms, &quot;Strimz&quot;, &quot;we&quot; and &quot;us&quot; mean STRIMZ LTD.
        &quot;You&quot; means the business that opens a Strimz account, and the person who opens it
        on that business&apos;s behalf.
      </p>

      <h2 id="agreement">2. This agreement</h2>
      <p>
        These terms are a binding agreement between you and us. They cover the Strimz website,
        dashboard, API, SDKs, hosted checkout and documentation, which we call &quot;Strimz&quot; or
        &quot;the Service&quot;.
      </p>
      <p>
        You accept these terms when you tick &quot;I agree&quot; in the dashboard. You may only do
        that if you are at least 18 years old and allowed to act for the business you sign up.
      </p>
      <p>
        If you do not agree, do not use Strimz. The{' '}
        <a href="/legal/acceptable-use">Acceptable Use Policy</a> and the{' '}
        <a href="/legal/privacy">Privacy Policy</a> form part of this agreement.
      </p>

      <h2 id="service">3. What Strimz does</h2>
      <p>
        Strimz lets your customers pay you in stablecoins (USDC and EURC) on a public blockchain. It
        gives you checkout pages, payment links, subscriptions, invoices, storefronts, an API and a
        dashboard.
      </p>
      <p>
        We never hold your money. Each payment goes on-chain from your customer&apos;s wallet to
        your payout wallet, in the same transaction that takes our fee. We never hold your private
        keys or your customers&apos; keys, and we cannot move funds out of your wallet.
      </p>
      <p>
        We do not provide banking, currency exchange, lending or investment services. We do not
        convert stablecoins to any other currency.
      </p>

      <h2 id="account">4. Your account</h2>
      <p>
        You must give us true and complete information about your business, and keep it up to date.
        We rely on your account email for notices and security alerts, so keep it working.
      </p>
      <p>
        You are responsible for everything done with your account, your API keys and your payout
        wallet. Keep your sign-in methods and secret keys private. If you think someone else has
        access, tell us at <a href="mailto:support@strimz.finance">support@strimz.finance</a>{' '}
        straight away and revoke the affected keys in the dashboard.
      </p>
      <p>
        Your payout wallet is registered on-chain. Changing it takes 24 hours, so that a stolen
        session cannot redirect your payments at once.
      </p>

      <h2 id="fees">5. Fees</h2>
      <p>
        We charge a fee on every payment made to you through Strimz. The fee is a percentage of the
        payment and is taken from it on-chain, at the moment the payment settles. You never receive
        a separate bill.
      </p>
      <ul>
        <li>
          <strong>Free:</strong> 0.5% is taken on-chain, and we refund it on your business&apos;s
          first 1,000 USDC and first 1,000 EURC of payments. The refund goes to your payout wallet.
        </li>
        <li>
          <strong>Starter:</strong> 0.5%, from 1,000 of total payments.
        </li>
        <li>
          <strong>Growth:</strong> 0.4%, from 50,000 of total payments.
        </li>
        <li>
          <strong>Enterprise:</strong> the rate in your written agreement with us.
        </li>
      </ul>
      <p>
        Your plan moves up automatically as your volume grows. Accounts that share a payout wallet
        or an owner wallet count as one business for the free 1,000.
      </p>
      <p>
        We may change our fees. We will email you at least 30 days before a change, and it only
        applies to payments made after it takes effect. Your fee can never go above the ceiling
        recorded for your account on-chain when you registered.
      </p>
      <p>You are responsible for any taxes on your sales and on our fees.</p>

      <h2 id="network-fees">6. Network fees</h2>
      <p>
        Every blockchain transaction has a small network fee. We usually pay it for your customers,
        so they only pay the price you set. We may stop paying it, for example when your account
        reaches its daily limit, when our relaying is paused, or when a wallet or network has been
        sending failed transactions. Your customer can then pay the network fee from their own
        wallet to complete the payment. We will not stop an honest payment from going through.
      </p>

      <h2 id="payments">7. Payments and refunds</h2>
      <p>
        A payment is final once it is confirmed on the blockchain. Nobody, including us, can reverse
        it.
      </p>
      <p>
        Refunds are your decision. A refund is a new transfer from your wallet to your
        customer&apos;s wallet. You can start one from the dashboard; you sign it, and we do not
        charge a fee on it. Disputes with your customers about your goods or services are between
        you and them.
      </p>
      <p>You must honour the prices, terms and refund policy you show your customers.</p>

      <h2 id="use">8. How you may use Strimz</h2>
      <p>
        You must follow the <a href="/legal/acceptable-use">Acceptable Use Policy</a> and every law
        that applies to you, including laws on sanctions, money laundering, terrorist financing,
        consumer protection and tax. You are responsible for what you sell.
      </p>
      <p>
        You must not try to break, overload, copy or misuse Strimz, its smart contracts or its
        limits, or use it to harm anyone.
      </p>
      <p>
        The Strimz name, logo, website, dashboard and documentation belong to STRIMZ LTD. Our
        open-source code is licensed separately under the licence in its repository.
      </p>

      <h2 id="data">9. Data and privacy</h2>
      <p>
        The <a href="/legal/privacy">Privacy Policy</a> explains what data we collect and how we use
        it. Payments on a public blockchain can be seen by anyone, including the wallets and amounts
        involved. You own your business data and your customers&apos; data. We process it to run
        Strimz for you.
      </p>

      <h2 id="availability">10. Availability and risks</h2>
      <p>
        We work hard to keep Strimz running, but we cannot promise it will always be available or
        free of errors. It depends on blockchains, wallets and other services that we do not
        control.
      </p>
      <p>
        Stablecoins, blockchains and smart contracts carry risks, including bugs, network outages,
        changes by the stablecoin issuer and changes in the law. Our smart contracts are open source
        and tested, but we cannot promise they have no faults.
      </p>
      <p>Apart from what these terms say, we provide Strimz as it is, without other promises.</p>

      <h2 id="liability">11. Liability</h2>
      <p>
        We are not liable for indirect or consequential losses, such as lost profits, lost business
        or lost data.
      </p>
      <p>
        Our total liability to you for all claims under these terms is limited to the greater of the
        fees you paid us in the 12 months before the claim arose, or 100 US dollars.
      </p>
      <p>
        Nothing in these terms limits liability that the law does not allow to be limited, such as
        liability for fraud.
      </p>

      <h2 id="suspension">12. Suspension and closing</h2>
      <p>
        We may suspend or close your account if you break these terms or the law, or if we must do
        so to protect your customers, other businesses or Strimz. We will tell you why unless the
        law or a regulator stops us. While your account is suspended, new payments are refused, but
        payments already started can still settle.
      </p>
      <p>
        You can close your account at any time by emailing{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a> from your account email.
        When an account closes, its API keys stop working and its webhooks stop. Money already in
        your payout wallet stays yours.
      </p>

      <h2 id="changes">13. Changes to these terms</h2>
      <p>
        We may change these terms. Each version has a date, shown at the top of this page. We will
        email you at least 14 days before a new version takes effect. You then need to accept it in
        the dashboard before you can make further changes there. Your API keys and checkout keep
        working in the meantime, so your customers can still pay you.
      </p>

      <h2 id="notices">14. Notices and contact</h2>
      <p>
        Send legal notices to <a href="mailto:legal@strimz.finance">legal@strimz.finance</a>. We
        send notices to your account email. For help with your account, write to{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a>. For anything else, write
        to <a href="mailto:hello@strimz.finance">hello@strimz.finance</a>.
      </p>

      <h2 id="law">15. Law and disputes</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
      <p>
        If we disagree about anything under these terms, we will first try to settle it by writing
        to each other in good faith. If we cannot settle it within 30 days, the courts of the
        Federal Capital Territory, Abuja, have exclusive jurisdiction.
      </p>
    </LegalDoc>
  )
}
