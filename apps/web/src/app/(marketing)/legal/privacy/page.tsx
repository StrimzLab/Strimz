import type { Metadata } from 'next'
import { LegalDoc } from '@/components/marketing/legal-doc'
import { OG_IMAGE } from '@strimz/web-shared/lib/seo'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How STRIMZ LTD collects, uses and protects the personal data of merchants and their customers, and the rights of data subjects under the Nigeria Data Protection Act 2023.',
  alternates: { canonical: '/legal/privacy' },
  openGraph: { title: 'Privacy Policy · Strimz', url: '/legal/privacy', images: [OG_IMAGE] },
}

const TOC = [
  { id: 'controller', label: '1. Who we are' },
  { id: 'collect', label: '2. Personal data we collect' },
  { id: 'not-collect', label: '3. Data we do not collect' },
  { id: 'basis', label: '4. Purposes and lawful basis' },
  { id: 'storage', label: '5. Cookies and local storage' },
  { id: 'share', label: '6. Disclosure to third parties' },
  { id: 'transfers', label: '7. International transfers' },
  { id: 'retention', label: '8. Retention' },
  { id: 'security', label: '9. Security' },
  { id: 'rights', label: '10. Your rights' },
  { id: 'children', label: '11. Children' },
  { id: 'changes', label: '12. Changes to this Policy' },
  { id: 'contact', label: '13. Contact' },
]

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      description="How STRIMZ LTD collects, uses and protects personal data, and the rights of data subjects."
      effectiveDate="22 November 2026"
      lastUpdated="23 November 2026"
      toc={TOC}
    >
      <h2 id="controller">1. Who we are</h2>
      <p>
        <strong>1.1</strong> This Privacy Policy explains how STRIMZ LTD, a private company limited
        by shares incorporated in the Federal Republic of Nigeria with registration number RC
        8624034 (&quot;Strimz&quot;, &quot;we&quot;, &quot;us&quot; or &quot;our&quot;), collects,
        uses, shares and protects personal data in connection with the Strimz website, dashboard,
        API, hosted checkout and related services (the &quot;Service&quot;).
      </p>
      <p>
        <strong>1.2</strong> Strimz is the data controller of the personal data of merchants who
        open an account (&quot;Merchants&quot;). Where Strimz processes the personal data of persons
        who pay a Merchant through the Service (&quot;Customers&quot;), it does so to provide the
        Service to that Merchant.
      </p>
      <p>
        <strong>1.3</strong> This Policy is issued in accordance with the Nigeria Data Protection
        Act 2023 (the &quot;NDPA&quot;). Where Merchants or Customers are located elsewhere, we also
        observe the data protection law that applies to them, including Kenya&apos;s Data Protection
        Act 2019, Ghana&apos;s Data Protection Act 2012 (Act 843), Uganda&apos;s Data Protection and
        Privacy Act 2019, Tanzania&apos;s Personal Data Protection Act 2022, Rwanda&apos;s Law No.
        058/2021 and, where applicable, the UK and EU General Data Protection Regulation.
      </p>

      <h2 id="collect">2. Personal data we collect</h2>
      <p>
        <strong>2.1</strong> From Merchants, we collect:
      </p>
      <ul>
        <li>
          name and email address, and the Google account details you choose to share if you sign in
          with Google;
        </li>
        <li>
          business details given during onboarding: business name, business sector, country,
          website, logo and telephone number;
        </li>
        <li>the Payout Wallet address and, where applicable, the owner wallet address;</li>
        <li>
          the version of the Terms of Service you accepted, with the date, time and IP address of
          acceptance;
        </li>
        <li>
          API keys, stored only as a cryptographic hash together with a short prefix, and webhook
          endpoint URLs;
        </li>
        <li>
          records of activity on your account, such as keys created, team members invited and
          settings changed; and
        </li>
        <li>correspondence you send to us.</li>
      </ul>
      <p>
        <strong>2.2</strong> From Customers, we collect: (a) the wallet address used to pay, which
        is also visible on the blockchain; (b) an email address, where the Merchant&apos;s checkout
        requests one; and (c) payment information that the Merchant attaches to a payment.
      </p>
      <p>
        <strong>2.3</strong> From all visitors, our servers and our hosting provider record
        technical data, namely IP address, browser type, language and the pages requested, for the
        purposes of operating and securing the Service.
      </p>

      <h2 id="not-collect">3. Data we do not collect</h2>
      <p>
        <strong>3.1</strong> We do not collect or store private keys or recovery phrases. Sign-in
        and embedded wallets are provided by Privy, and passkeys are held on your device and by
        Privy.
      </p>
      <p>
        <strong>3.2</strong> We do not collect card numbers, bank account details or images of
        identity documents.
      </p>

      <h2 id="basis">4. Purposes and lawful basis</h2>
      <p>
        <strong>4.1</strong> We process personal data for the following purposes and on the
        following lawful bases under the NDPA:
      </p>
      <ul>
        <li>
          to create and operate your account, settle payments to your Payout Wallet and provide the
          Service: performance of a contract;
        </li>
        <li>
          to send transactional messages such as sign-in codes, receipts and security alerts:
          performance of a contract;
        </li>
        <li>
          to prevent fraud and abuse, including bot checks, rate limits and the detection of leaked
          keys: legitimate interest;
        </li>
        <li>
          to keep records of your acceptance of our Terms of Service and to meet accounting and tax
          requirements: legal obligation and legitimate interest; and
        </li>
        <li>to respond to lawful requests from competent authorities: legal obligation.</li>
      </ul>
      <p>
        <strong>4.2</strong> We do not sell personal data, and we do not use it for advertising.
      </p>

      <h2 id="storage">5. Cookies and local storage</h2>
      <p>
        <strong>5.1</strong> The Service stores only what is necessary for it to function. We do not
        use analytics, advertising or cross-site tracking cookies. If we introduce any optional tool
        of that kind, we shall request your consent before it is loaded.
      </p>
      <p>
        <strong>5.2</strong> The items we store on your device are:
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Where</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>strimz-theme</code> (local storage)
              </td>
              <td>All Strimz sites</td>
              <td>Remembers your choice of light or dark mode.</td>
              <td>Until cleared</td>
            </tr>
            <tr>
              <td>Privy sign-in session (cookies and local storage)</td>
              <td>Dashboard, admin console and checkout</td>
              <td>Keeps you signed in and connects your wallet.</td>
              <td>Until you sign out or the session expires</td>
            </tr>
            <tr>
              <td>
                <code>strimz:signup-turnstile</code> (session storage)
              </td>
              <td>Dashboard sign-up</td>
              <td>Holds the result of the bot check while your account is created.</td>
              <td>Removed when used, and never kept longer than five minutes</td>
            </tr>
            <tr>
              <td>
                <code>strimz.tour.completed</code> (local storage)
              </td>
              <td>Dashboard</td>
              <td>Stops the dashboard tour from appearing again.</td>
              <td>Until cleared</td>
            </tr>
            <tr>
              <td>
                <code>strimz.refund.broadcast.*</code> (local storage)
              </td>
              <td>Dashboard</td>
              <td>Prevents a refund from being sent twice if the page reloads.</td>
              <td>Removed once the refund is recorded</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>5.3</strong> Cloudflare Turnstile, and the equivalent check operated by Privy, run
        on our sign-up, sign-in and contact forms to detect automated traffic, and Cloudflare may
        set a short-lived security cookie for the same purpose. You may clear stored items through
        your browser settings, in which case you may need to sign in again.
      </p>

      <h2 id="share">6. Disclosure to third parties</h2>
      <p>
        <strong>6.1</strong> We share personal data only with the service providers we use to
        operate the Service, and only to the extent necessary:
      </p>
      <ul>
        <li>
          <strong>Privy</strong>: sign-in, embedded wallets and passkeys;
        </li>
        <li>
          <strong>Resend</strong>: delivery of transactional email;
        </li>
        <li>
          <strong>Cloudflare</strong>: hosting of our websites, DNS, bot protection and encrypted
          database backups;
        </li>
        <li>
          <strong>OVHcloud</strong>: hosting of our API and database;
        </li>
        <li>
          <strong>Zoho</strong>: our company email; and
        </li>
        <li>
          <strong>Circle</strong> and <strong>TRM Labs</strong> or <strong>Elliptic</strong>: only
          if, in future, cross-chain payments or wallet sanctions screening are enabled, in which
          case only transaction hashes or wallet addresses are shared. Neither is in use today.
        </li>
      </ul>
      <p>
        <strong>6.2</strong> We disclose personal data where required by law, court order or a
        competent authority. Where permitted by law, we shall notify the affected Merchant of such a
        request.
      </p>

      <h2 id="transfers">7. International transfers</h2>
      <p>
        <strong>7.1</strong> Some of our service providers process data outside Nigeria. Where we
        transfer personal data outside Nigeria, we do so in accordance with Part VIII of the NDPA,
        relying on an adequate level of protection in the receiving country or on appropriate
        contractual safeguards.
      </p>

      <h2 id="retention">8. Retention</h2>
      <p>
        <strong>8.1</strong> We keep Merchant data for as long as the account remains open and for
        up to seven (7) years after it is closed, in order to meet legal, accounting and tax
        obligations.
      </p>
      <p>
        <strong>8.2</strong> Webhook delivery logs are kept for ninety (90) days. Records of your
        acceptance of our Terms of Service are kept for as long as we keep your account data.
      </p>
      <p>
        <strong>8.3</strong> Encrypted backups of our database are kept for fourteen (14) days and
        then deleted. Data removed from our live systems may remain in these backups until then.
      </p>
      <p>
        <strong>8.4</strong> Data recorded on a public blockchain is permanent and cannot be altered
        or deleted by us or by anyone else.
      </p>

      <h2 id="security">9. Security</h2>
      <p>
        <strong>9.1</strong> We protect personal data with technical and organisational measures
        appropriate to the risk, including encryption of data in transit, access controls on our
        servers and database, storage of API keys and webhook secrets only as cryptographic hashes,
        and a check on every request that it relates to the account making it.
      </p>
      <p>
        <strong>9.2</strong> If a personal data breach occurs that is likely to result in a risk to
        your rights and freedoms, we shall notify the Nigeria Data Protection Commission and, where
        required, the affected persons, as the NDPA requires.
      </p>
      <p>
        <strong>9.3</strong> Security vulnerabilities may be reported to{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a>.
      </p>

      <h2 id="rights">10. Your rights</h2>
      <p>
        <strong>10.1</strong> Subject to the NDPA and the other laws listed in clause 1.3, you have
        the right to: (a) be informed about our processing of your personal data; (b) obtain a copy
        of it; (c) have inaccurate data corrected; (d) have your data erased, subject to our legal
        retention obligations; (e) restrict or object to certain processing; (f) receive your data
        in a commonly used, machine-readable format; and (g) withdraw any consent you have given,
        without affecting processing carried out before the withdrawal.
      </p>
      <p>
        <strong>10.2</strong> To exercise any of these rights, write to{' '}
        <a href="mailto:support@strimz.finance">support@strimz.finance</a>. We shall respond within
        thirty (30) days.
      </p>
      <p>
        <strong>10.3</strong> You may lodge a complaint with the Nigeria Data Protection Commission
        or with the data protection authority of the country in which you live.
      </p>

      <h2 id="children">11. Children</h2>
      <p>
        <strong>11.1</strong> The Service is provided to businesses and is not directed at persons
        under eighteen (18) years of age. We do not knowingly collect their personal data, and we
        shall delete any such data of which we become aware.
      </p>

      <h2 id="changes">12. Changes to this Policy</h2>
      <p>
        <strong>12.1</strong> We may amend this Policy. Each version is dated on this page, and we
        shall notify Merchants of material changes by email.
      </p>

      <h2 id="contact">13. Contact</h2>
      <p>
        <strong>13.1</strong> STRIMZ LTD, a company registered in Nigeria, RC 8624034.
      </p>
      <p>
        <strong>13.2</strong> Questions about this Policy and requests concerning your personal
        data: <a href="mailto:support@strimz.finance">support@strimz.finance</a>. Formal legal
        notices: <a href="mailto:legal@strimz.finance">legal@strimz.finance</a>. General enquiries:{' '}
        <a href="mailto:hello@strimz.finance">hello@strimz.finance</a>.
      </p>
    </LegalDoc>
  )
}
