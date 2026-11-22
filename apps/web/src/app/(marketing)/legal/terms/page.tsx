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
  { id: 'parties', label: '1. Parties and definitions' },
  { id: 'acceptance', label: '2. Acceptance and capacity' },
  { id: 'service', label: '3. The Service' },
  { id: 'account', label: '4. Merchant account and security' },
  { id: 'fees', label: '5. Fees' },
  { id: 'network-fees', label: '6. Network fees' },
  { id: 'payments', label: '7. Payments and refunds' },
  { id: 'conduct', label: '8. Merchant obligations' },
  { id: 'ip', label: '9. Intellectual property' },
  { id: 'data', label: '10. Data protection' },
  { id: 'availability', label: '11. Availability and risk' },
  { id: 'disclaimer', label: '12. Disclaimer' },
  { id: 'liability', label: '13. Limitation of liability' },
  { id: 'indemnity', label: '14. Indemnity' },
  { id: 'termination', label: '15. Suspension and termination' },
  { id: 'changes', label: '16. Amendments' },
  { id: 'notices', label: '17. Notices' },
  { id: 'law', label: '18. Governing law and disputes' },
  { id: 'general', label: '19. General' },
]

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      description={`The agreement between your business and STRIMZ LTD for the use of Strimz. Version ${TERMS_VERSION}.`}
      effectiveDate="22 November 2026"
      lastUpdated="22 November 2026"
      toc={TOC}
    >
      <h2 id="parties">1. Parties and definitions</h2>
      <p>
        <strong>1.1</strong> These Terms of Service (the &quot;Agreement&quot;) are made between
        STRIMZ LTD, a private company limited by shares incorporated in the Federal Republic of
        Nigeria under the Companies and Allied Matters Act 2020 with registration number RC 8624034
        (&quot;Strimz&quot;, &quot;we&quot;, &quot;us&quot; or &quot;our&quot;), and the business
        that opens an account with Strimz (the &quot;Merchant&quot; or &quot;you&quot;).
      </p>
      <p>
        <strong>1.2</strong> In this Agreement: (a) &quot;Service&quot; means the Strimz website,
        dashboard, application programming interface (&quot;API&quot;), software development kits,
        hosted checkout, smart contracts and documentation; (b) &quot;Customer&quot; means any
        person who makes a payment to the Merchant through the Service; (c) &quot;Payout
        Wallet&quot; means the blockchain wallet address registered by the Merchant to receive
        payments; (d) &quot;Stablecoin&quot; means USDC, EURC or any other digital token that Strimz
        supports from time to time; (e) &quot;Fees&quot; means the charges described in clause 5;
        and (f) &quot;Network Fee&quot; means the fee charged by a blockchain network to process a
        transaction.
      </p>
      <p>
        <strong>1.3</strong> Headings are for convenience only and do not affect interpretation. The
        words &quot;include&quot; and &quot;including&quot; are illustrative and do not limit the
        words that precede them.
      </p>

      <h2 id="acceptance">2. Acceptance and capacity</h2>
      <p>
        <strong>2.1</strong> The Merchant accepts this Agreement by ticking the box marked &quot;I
        agree&quot; in the dashboard. This Agreement takes effect from that moment.
      </p>
      <p>
        <strong>2.2</strong> The person accepting this Agreement represents that they are at least
        eighteen (18) years of age and are duly authorised to bind the Merchant.
      </p>
      <p>
        <strong>2.3</strong> The <a href="/legal/acceptable-use">Acceptable Use Policy</a> and the{' '}
        <a href="/legal/privacy">Privacy Policy</a> form part of this Agreement. If there is a
        conflict between them and this Agreement, this Agreement prevails.
      </p>

      <h2 id="service">3. The Service</h2>
      <p>
        <strong>3.1</strong> The Service enables the Merchant to accept payments in Stablecoin from
        Customers on a public blockchain, by way of checkout pages, payment links, subscriptions,
        invoices, storefronts and the API.
      </p>
      <p>
        <strong>3.2</strong> Strimz does not take custody of funds. Each payment is transferred on
        the blockchain from the Customer&apos;s wallet to the Payout Wallet, and the Fees are
        deducted in the same transaction. Strimz does not hold, and cannot access, the private keys
        of the Merchant or of any Customer, and cannot move funds out of the Payout Wallet.
      </p>
      <p>
        <strong>3.3</strong> Strimz does not provide banking, deposit-taking, currency exchange,
        lending, investment or custodial services, and does not convert Stablecoin into any other
        currency.
      </p>
      <p>
        <strong>3.4</strong> The Service is offered to businesses in Nigeria and in other African
        countries. A Merchant established outside Nigeria is responsible for ensuring that its use
        of the Service, and its acceptance of Stablecoin payments, is lawful in its own country.
        Strimz may decline to offer the Service in a country where it considers it unable to do so
        lawfully.
      </p>

      <h2 id="account">4. Merchant account and security</h2>
      <p>
        <strong>4.1</strong> The Merchant shall provide accurate and complete information about
        itself and shall keep that information up to date.
      </p>
      <p>
        <strong>4.2</strong> Strimz shall send notices and security alerts to the email address
        registered on the Merchant&apos;s account. The Merchant shall ensure that this address
        remains valid and monitored.
      </p>
      <p>
        <strong>4.3</strong> The Merchant is responsible for all activity carried out through its
        account, its API keys and its Payout Wallet, and shall keep its sign-in methods and secret
        keys confidential.
      </p>
      <p>
        <strong>4.4</strong> The Merchant shall notify Strimz without delay at{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a> if it suspects any
        unauthorised access, and shall immediately revoke any affected API key.
      </p>
      <p>
        <strong>4.5</strong> A change to the Payout Wallet is recorded on the blockchain and takes
        effect only after a delay of twenty-four (24) hours.
      </p>

      <h2 id="fees">5. Fees</h2>
      <p>
        <strong>5.1</strong> Strimz charges a fee on each payment made to the Merchant through the
        Service. The fee is a percentage of the payment amount and is deducted on the blockchain at
        the time the payment settles.
      </p>
      <p>
        <strong>5.2</strong> The applicable rates are: (a) Free plan: 0.5%, which Strimz refunds to
        the Payout Wallet on the first 1,000 USDC and the first 1,000 EURC of payments received by
        the Merchant&apos;s business; (b) Starter plan: 0.5%, from 1,000 of total payments; (c)
        Growth plan: 0.4%, from 50,000 of total payments; and (d) Enterprise plan: the rate set out
        in a separate written agreement.
      </p>
      <p>
        <strong>5.3</strong> The Merchant&apos;s plan changes automatically as its payment volume
        grows. Accounts that share a Payout Wallet or an owner wallet are treated as a single
        business for the purpose of clause 5.2(a).
      </p>
      <p>
        <strong>5.4</strong> Strimz may change the Fees by giving the Merchant not less than thirty
        (30) days&apos; notice by email. A change applies only to payments made after it takes
        effect. The Fees shall not exceed the maximum rate recorded for the Merchant&apos;s account
        on the blockchain at registration.
      </p>
      <p>
        <strong>5.5</strong> The Merchant is responsible for all taxes due on its sales and on the
        Fees.
      </p>

      <h2 id="network-fees">6. Network fees</h2>
      <p>
        <strong>6.1</strong> Strimz may, at its discretion, pay the Network Fee on behalf of a
        Customer.
      </p>
      <p>
        <strong>6.2</strong> Strimz may decline to pay the Network Fee, including where the Merchant
        has reached its daily limit, where Strimz has paused relaying, or where a wallet or network
        has submitted failed transactions. In that event the Customer may pay the Network Fee from
        its own wallet and complete the payment.
      </p>

      <h2 id="payments">7. Payments and refunds</h2>
      <p>
        <strong>7.1</strong> A payment is final once it is confirmed on the blockchain and cannot be
        reversed by Strimz or by any other person.
      </p>
      <p>
        <strong>7.2</strong> Refunds are at the Merchant&apos;s sole discretion. A refund is a
        separate transfer from the Merchant&apos;s wallet to the Customer&apos;s wallet, which the
        Merchant authorises and signs. Strimz does not charge a fee on refunds.
      </p>
      <p>
        <strong>7.3</strong> Any dispute between the Merchant and a Customer concerning goods or
        services is solely between them. The Merchant shall honour the prices, terms and refund
        policy it presents to Customers.
      </p>

      <h2 id="conduct">8. Merchant obligations</h2>
      <p>
        <strong>8.1</strong> The Merchant shall comply with the Acceptable Use Policy and with all
        laws and regulations that apply to it, including those relating to sanctions, anti-money
        laundering, counter-terrorist financing, consumer protection and taxation.
      </p>
      <p>
        <strong>8.2</strong> The Merchant is solely responsible for the goods and services it offers
        and for any representation it makes to Customers.
      </p>
      <p>
        <strong>8.3</strong> The Merchant shall not attempt to interfere with, overload,
        reverse-engineer, circumvent the limits of, or otherwise misuse the Service or its smart
        contracts, and shall not use the Service to harm any person.
      </p>

      <h2 id="ip">9. Intellectual property</h2>
      <p>
        <strong>9.1</strong> The Strimz name, logo, website, dashboard and documentation are the
        property of STRIMZ LTD. Nothing in this Agreement transfers any of those rights to the
        Merchant.
      </p>
      <p>
        <strong>9.2</strong> Software that Strimz publishes as open source is licensed under the
        terms stated in its repository, which apply in place of this clause for that software.
      </p>

      <h2 id="data">10. Data protection</h2>
      <p>
        <strong>10.1</strong> Each party shall comply with the Nigeria Data Protection Act 2023 and
        any other data protection law that applies to it.
      </p>
      <p>
        <strong>10.2</strong> Strimz processes personal data as described in the Privacy Policy.
        Where Strimz processes personal data of Customers on the Merchant&apos;s behalf, it does so
        to provide the Service and on the Merchant&apos;s instructions as expressed through its use
        of the Service.
      </p>
      <p>
        <strong>10.3</strong> The Merchant acknowledges that transactions on a public blockchain,
        including wallet addresses and amounts, are visible to the public.
      </p>

      <h2 id="availability">11. Availability and risk</h2>
      <p>
        <strong>11.1</strong> Strimz shall use reasonable efforts to keep the Service available, but
        does not guarantee that it will be uninterrupted or free from errors.
      </p>
      <p>
        <strong>11.2</strong> The Service depends on blockchain networks, Stablecoin issuers, wallet
        providers and other third parties that Strimz does not control. The Merchant accepts the
        risks of using Stablecoin and blockchain technology, including network outages, smart
        contract defects, actions of Stablecoin issuers and changes in law.
      </p>

      <h2 id="disclaimer">12. Disclaimer</h2>
      <p>
        <strong>12.1</strong> Except as expressly stated in this Agreement, the Service is provided
        &quot;as is&quot; and &quot;as available&quot;, and Strimz excludes all other warranties,
        conditions and representations, whether express or implied, to the fullest extent permitted
        by law.
      </p>

      <h2 id="liability">13. Limitation of liability</h2>
      <p>
        <strong>13.1</strong> Strimz shall not be liable for any indirect or consequential loss, or
        for any loss of profit, revenue, business, goodwill or data, however arising.
      </p>
      <p>
        <strong>13.2</strong> The total liability of Strimz arising out of or in connection with
        this Agreement shall not exceed the greater of (a) the Fees paid by the Merchant in the
        twelve (12) months preceding the event giving rise to the claim, and (b) one hundred United
        States dollars (USD 100).
      </p>
      <p>
        <strong>13.3</strong> Nothing in this Agreement limits or excludes liability for fraud or
        for any other liability that cannot be limited or excluded by law.
      </p>

      <h2 id="indemnity">14. Indemnity</h2>
      <p>
        <strong>14.1</strong> The Merchant shall indemnify Strimz against all losses, costs and
        claims arising from the Merchant&apos;s breach of this Agreement or of any law, or from any
        claim by a Customer concerning the Merchant&apos;s goods or services.
      </p>

      <h2 id="termination">15. Suspension and termination</h2>
      <p>
        <strong>15.1</strong> Strimz may suspend or close the Merchant&apos;s account where the
        Merchant breaches this Agreement or any law, or where Strimz reasonably considers it
        necessary to protect Customers, other merchants or the Service. Strimz shall give reasons
        unless prohibited by law or by a competent authority.
      </p>
      <p>
        <strong>15.2</strong> During a suspension, new payments are refused. Payments already
        initiated may complete.
      </p>
      <p>
        <strong>15.3</strong> The Merchant may close its account at any time by written request to{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a> from the email address
        registered on the account.
      </p>
      <p>
        <strong>15.4</strong> On closure, the Merchant&apos;s API keys and webhooks cease to
        operate. Funds held in the Payout Wallet remain the property and under the control of the
        Merchant. Clauses 7, 9, 12, 13, 14, 17 and 18 survive termination.
      </p>

      <h2 id="changes">16. Amendments</h2>
      <p>
        <strong>16.1</strong> Strimz may amend this Agreement. Each version is dated and published
        on this page.
      </p>
      <p>
        <strong>16.2</strong> Strimz shall give the Merchant not less than fourteen (14) days&apos;
        notice of an amendment by email. The Merchant must accept the amended Agreement in the
        dashboard before it may make further changes there. API keys and checkout continue to
        operate in the meantime.
      </p>

      <h2 id="notices">17. Notices</h2>
      <p>
        <strong>17.1</strong> Legal notices to Strimz shall be sent by email to{' '}
        <a href="mailto:legal@strimz.finance">legal@strimz.finance</a>. Notices to the Merchant
        shall be sent to the email address registered on its account.
      </p>
      <p>
        <strong>17.2</strong> A notice sent by email is deemed received on the next business day
        after it is sent, unless the sender receives notice of non-delivery.
      </p>
      <p>
        <strong>17.3</strong> For support, the Merchant may contact{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a>. General enquiries may be
        sent to <a href="mailto:hello@strimz.finance">hello@strimz.finance</a>.
      </p>

      <h2 id="law">18. Governing law and disputes</h2>
      <p>
        <strong>18.1</strong> This Agreement and any dispute arising out of or in connection with it
        shall be governed by and construed in accordance with the laws of the Federal Republic of
        Nigeria.
      </p>
      <p>
        <strong>18.2</strong> The parties shall first attempt in good faith to resolve any dispute
        by written correspondence. If the dispute is not resolved within thirty (30) days, the
        courts of the Federal Capital Territory, Abuja, shall have exclusive jurisdiction.
      </p>
      <p>
        <strong>18.3</strong> The choice of Nigerian law in clause 18.1 does not deprive the
        Merchant of any protection afforded to it by the mandatory laws of the country in which it
        is established.
      </p>

      <h2 id="general">19. General</h2>
      <p>
        <strong>19.1</strong> This Agreement constitutes the entire agreement between the parties
        concerning its subject matter and supersedes any prior understanding.
      </p>
      <p>
        <strong>19.2</strong> If any provision of this Agreement is found invalid or unenforceable,
        the remaining provisions continue in full force.
      </p>
      <p>
        <strong>19.3</strong> A failure or delay in exercising a right does not operate as a waiver
        of that right.
      </p>
      <p>
        <strong>19.4</strong> The Merchant may not assign or transfer its rights under this
        Agreement without the prior written consent of Strimz. Strimz may assign this Agreement to a
        successor to its business.
      </p>
      <p>
        <strong>19.5</strong> Neither party is liable for a failure or delay caused by events beyond
        its reasonable control, including the failure of a blockchain network or of a Stablecoin
        issuer.
      </p>
    </LegalDoc>
  )
}
