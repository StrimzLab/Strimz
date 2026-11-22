---
date: 2026-11-22
feature: Plain-English Terms of Service under Nigerian law, with a required "I agree" and recorded acceptance
scope: feature
scenario-impact: updated
---

# Terms of Service, and agreeing to them

Closes #508. ADR: [ADR-2026-11-21-terms-acceptance](../adr/ADR-2026-11-21-terms-acceptance.md).

## For merchants

- **New Terms of Service in plain English** (version 2026-11-22).
  - The agreement is with STRIMZ LTD, registered in Nigeria under RC 8624034.
  - Nigerian law applies, and disputes go to the courts of the Federal Capital Territory, Abuja.
  - Legal notices go to legal@strimz.finance.
- **Onboarding has a required "I agree to the Terms of Service and Privacy Policy" box.** "Complete onboarding" stays disabled until it's ticked.
- **When the terms change,** the dashboard asks you to accept the new version. Until you do, you can look around but not change anything. Your API keys and checkout keep working, so your customers can still pay.
- **Existing merchants** are asked to accept once, at their next visit.

## The documents

- **Formal legal drafting.** The Terms of Service now have 19 numbered sections, with defined terms, an indemnity, notice rules and general clauses.
- **Other African countries.** Strimz serves businesses in Nigeria and in other African countries (clause 3.4). Nigerian law governs, but it doesn't remove protections a merchant's own country gives by law (clause 18.3).
- **Privacy Policy.** Rewritten in the same form, under the Nigeria Data Protection Act 2023, keeping the Kenyan, Ghanaian, Ugandan, Tanzanian and Rwandan laws. It now states:
  - the lawful basis for each kind of processing;
  - the rules for transfers outside Nigeria;
  - breach notification to the Nigeria Data Protection Commission.
- **Privacy facts corrected:**
  - onboarding collects business name, sector, country, website, logo and phone, not "legal name, registered address, tax ID";
  - no claim of "managed database encryption", which we couldn't confirm;
  - Turnstile now also runs on sign-up and sign-in;
  - the storage table lists the sign-up check token and the passkey offer date;
  - terms acceptance records (version, time, IP) are listed;
  - Zoho is named as our email provider.

## Corrections

- **Company name:** "Strimz Labs Ltd." is gone everywhere. It is now STRIMZ LTD (RC 8624034) in the terms, the privacy policy and the dashboard footer.
- **Address:** the privacy policy's London address was never ours and is removed.
- **Law:** the old terms said English law and London courts.
- **Email addresses:** the only public addresses are support@, legal@ and hello@strimz.finance. Stray example addresses (founder@, data@, `@strimz.io`) are fixed. Automatic emails still come from the send-only `noreply@mail.strimz.finance`.

## For operators

- **Migration** `20261122090000_terms_acceptance` adds `Merchant.termsVersion`, `termsAcceptedAt` and `termsAcceptedIp`. Run it before the new API starts.
- **Onboarding** needs `acceptedTerms` set to the current `TERMS_VERSION`. Otherwise the API answers `400 terms_required`.
- **Dashboard changes** answer `403 terms_required` until the current version is accepted, with `POST /v1/merchants/me/terms { version }`. Each acceptance is written to the audit log as `terms.accepted`.
- **Deploy the dashboard with the API.** The old dashboard doesn't send `acceptedTerms`, so new onboardings would fail.
- **A Nigerian lawyer should review the text before mainnet.**

## Tests

- **API:** `terms-acceptance.e2e` covers onboarding without the box ticked or with an old version, recording and auditing, the dashboard block and unblock, current version only, and API keys never blocked.
- **Updated:** the onboarding and route-list tests.
- **Shared code:** web-shared `legal-identity` checks the company, law and courts, and that only the three mailboxes are used. The `dashboardGate` tests cover the terms step.
