# Terms of service and "I agree" (plain English)

- **Status:** Accepted 2026-11-22 by the founder
- **Technical version:** [ADR-2026-11-21-terms-acceptance](ADR-2026-11-21-terms-acceptance.md)

## What's wrong today

- Our terms name a company called "Strimz Labs Ltd.", but the company on our CAC certificate is **STRIMZ LTD** (RC 8624034). The privacy policy and the dashboard footer have the same mistake.
- The terms say English law and London courts apply. We want Nigerian law.
- Nobody actually ticks "I agree", and we keep no record of who agreed to which version.

## What we'll do

1. **Rewrite the terms in plain English.** Short sentences, one rule at a time, nothing vague. They will name STRIMZ LTD, its registered office and its RC number, and say Nigerian law applies. Every version is dated.
2. **A required "I agree" box in onboarding.** The "Finish" button stays greyed out until the box is ticked.
3. **Keep proof.** We save which version each merchant agreed to, when, and from which internet address, and write it to the audit log.
4. **When the terms change,** merchants get 14 days' notice by email. The next time they open the dashboard, they're asked to agree to the new version. Until they do, they can look around but can't change anything.
5. **Payments never stop.** A merchant's website keeps taking payments even if the owner hasn't agreed to new terms yet. Their customers shouldn't suffer for it.

## What the founder decided (2026-11-22)

- **Legal notices** go to `legal@strimz.finance`. Support is `support@strimz.finance`, and general mail is `hello@strimz.finance`. No other addresses are used.
- **Address:** Nigeria. Strimz is a digital product, so the terms give the company as registered in Nigeria, with its RC number.
- **Courts:** Abuja (Federal Capital Territory).

A Nigerian lawyer should read the final text before we launch on mainnet.
