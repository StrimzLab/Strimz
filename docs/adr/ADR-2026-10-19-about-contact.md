# ADR: About and Contact pages that build trust with businesses

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #282 (part of #286)

## Context

**About** has these problems:

- A centred headline and three paragraphs, followed by a stats band and "What we believe".
- Its copy compares Strimz with cards:
  - "No card-rails legacy, no chargebacks";
  - "card-era processors";
  - "the same primitives card processors gave them";
  - "No three-day clearing window".
- It does not tell a business why to trust Strimz with its revenue.
- The stats band is now true (Arc, 2 stablecoins, 0 gas for customers, 0 funds held). The invented "99.97%" and "6 chains" went in #154.

**Contact** has these problems:

- Three inbox cards (Sales, Support, Security) that all show `support@strimz.finance` and are keyed by that address. React logs a duplicate-key error, and the page repeats one address three times.
- Old flat buttons.
- The issue asks for a "Book a demo" action and for reply-time promises the team can honour.

### Maintainer decisions (2026-10-19)

- **Reply times:** keep "reply within one business day" and the office hours (Monday to Friday, 09:00–18:00 UTC; security and outage emails answered right away).
- **Book a demo:** no booking tool. It opens an email to support@ with the subject "Demo request".
- **No team section** at launch.
- **Safety claims allowed:**
  - non-custodial;
  - on-chain receipts;
  - the contracts have been privately audited. The source is the maintainer, and no public report exists.

## Decision

### D1. About: `/about`, rebuilt in the homepage design language

1. **Hero.** Mission in one line, "Billing for businesses that get paid in stablecoins.", and a sentence on what Strimz does.
2. **Why stablecoins for business.** Three cards, each sourced:
   - **Paid in seconds:** settlement on Arc, which has deterministic sub-second finality (`concepts/overview`).
   - **Final once it settles:** a confirmed payment is not reorged away (`concepts/modes-of-failure`).
   - **Customers anywhere:** anyone with USDC or EURC in a wallet can pay, and they pay no gas (`checkout/hosted`).
3. **How we keep your money safe.** Three points:
   - **Non-custodial:** payments settle into a wallet you control (FAQ, `concepts/meta-tx-flow`).
   - **On-chain receipts:** every payment is an Arc transaction anyone can verify.
   - **Privately audited contracts:** "Our smart contracts have been through a private security audit." Maintainer-provided; it makes no claim of a public report.
4. **Facts band:** Arc, 2 stablecoins (USDC, EURC), 0 gas your customers pay, 0 funds we hold. This is the current `NUMBERS`, restyled.
5. **The shared closing panel.** "Start free" goes to `/signup`; "Talk to us" goes to `/contact`.

There are no comparisons, no team section, and the lucide icons are replaced with Solar icons.

### D2. Contact: `/contact`

1. **Hero.** "Talk to a real person." with a short line about the single inbox.
2. **One inbox card for `support@strimz.finance`.**
   - A subject guide, generated from `CONTACT_TOPICS` (Sales, Support, Security), each with what to write.
   - Each topic is keyed by label and has a mailto link with that subject.
   - A "Book a demo" `PopLink` opens `mailto:support@strimz.finance?subject=Demo%20request`.
3. **The form.** `ContactForm` itself is unchanged. It sits beside two cards:
   - **Priority email support** on Starter, Growth and Enterprise, from `PLANS[tier].prioritySupport`.
   - **Office hours,** as the maintainer confirmed.
4. **Layout and styling:** theme tokens and keycap buttons. There is no closing panel, since the page already is the contact point.

### D3. Tests

- **The no-comparison guard extends** to `about/page.tsx` and `contact/page.tsx`.
- **The "are audited" ban becomes a narrower rule.** The about page may say the contracts were privately audited, and must not claim a public or third-party report. A new check bans "audit report", "audited by", "certified" and "independently audited" on marketing pages.
- **Contact topics:**
  - each label appears once;
  - there is a single inbox address;
  - every mailto targets support@ with an encoded subject;
  - the demo link has the subject "Demo request".
- **Priority support** text matches the plans whose `prioritySupport` is true.

```
about/page.tsx    Hero ─ WhyStablecoins(3) ─ Safety(3) ─ FactsBand ─ Closing
contact/page.tsx  Hero ─ InboxCard(CONTACT_TOPICS, Book a demo) ─ ContactForm ┬ PriorityCard(PLANS)
                                                                              └ HoursCard
lib/contact-topics.ts  CONTACT_TOPICS, SUPPORT_EMAIL, mailto()
```

## Consequences

- Both pages make only claims that are sourced. The PR lists each one with its source.
- The duplicate-key bug goes away, because there is one inbox card and the topics are keyed by label.
- If a public audit report is published later, the safety card can link it.

## Alternatives considered

- **Keep three inbox cards with the same address.** That repeats one email three times. Rejected.
- **"Open-source contracts" and "relayer can't move funds".** These are true, but the maintainer did not choose them. They are left out.
- **A booking widget.** There is no tool. It can be added later by swapping the mailto for a link.

## Verification

- New tests go red, then green.
- `./scripts/preflight.sh` passes in full.
- Chrome on `/about` and `/contact` at 1440, 768 and 390, in light and dark, and with reduced motion. No duplicate-key error in the console. The form still validates and submits as before.
