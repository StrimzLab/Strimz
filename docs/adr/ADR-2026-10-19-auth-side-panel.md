# ADR: Business-facing sign-in and sign-up side panel

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #283 (part of #286)

## Context

The `(auth)` layout wraps `/signup`, `/login`, `/callback` and `/onboarding`. Its navy left panel says "Stablecoin billing infrastructure for the next billion businesses. One API. Settled in USDC on Arc."

- "Next billion" is a scale claim with nothing behind it.
- "One API" is a developer pitch, shown at the moment a business owner decides.
- The "Live on Arc" badge sits at the bottom edge and can be cut off.
- The panel is hidden on phones, so phone sign-ups see no reason to sign up.

The issue asks for:

- a sign-up panel with three business benefits and a "payment received" visual;
- a calmer "Welcome back" for sign-in;
- the clipped badge fixed;
- no "API" or chain names beyond a small "Settled in USDC" line;
- a phone layout that keeps the form first.

The issue suggests "no chargebacks" as a benefit. That compares Strimz with cards, which the maintainer has ruled out. It is replaced with a fact about Strimz itself.

## Decision

### D1. `AuthPanel`, a client component chosen by route

It lives at `components/auth/auth-panel.tsx` and reads `usePathname()`.

- **`/signup` and `/onboarding`, "new":**
  - **Headline:** "Get paid in USDC and EURC, straight to your wallet."
  - **Three benefits with Solar icons:**
    - **Paid in seconds:** each payment settles moments after your customer approves.
    - **Into your own wallet:** Strimz never holds your money.
    - **Free to start:** 0% on your first $1,000. The figures come from `PLANS.free.feeBps` and `PLANS.starter.entersAtVolume`.
  - **A "payment received" card:** "+49.00 USDC, Pro plan, settled", with a small "Sample" tag.
- **`/login` and `/callback`, "returning":**
  - **Headline:** "Welcome back."
  - **One supporting line:** "Your payments, subscriptions and invoices are where you left them."
  - **A "This month" mini card:** sample payments with a small bar sparkline and a "Sample" tag.
- **Bottom line:** "Settled in USDC and EURC" with a green dot. It sits in normal flow with bottom padding and safe-area inset, so it can't clip.
- **Kept:** the navy panel, the two pattern images and the white logo.
- **Motion:** the copy lines and the card rise in once on mount, with the card floating slightly. All of it stops under reduced motion.

### D2. Phone

The left panel stays hidden below `md`. On `/signup` only, a compact row of the three benefits (icon and short label) appears under the header and above the form, so the form stays in the first screen. Sign-in shows nothing extra.

### D3. Tests

`auth-panel.test.ts`:

- **The copy mentions none of:** "API", "next billion", "chargeback", "card", or chain names other than the "Settled in USDC" line.
- **The free-tier benefit** comes from `PLANS`.
- **Variants:** `/signup` and `/onboarding` map to "new"; `/login` and `/callback` map to "returning". The variant function is pure and exported.
- **Sample figures:** every sample card carries a "Sample" label.

```
app/(auth)/layout.tsx ── <AuthPanel/> (md+, left)  ┬ variant = authVariant(pathname)
                       └ <AuthBenefitsRow/> (below md, /signup only)
components/auth/auth-panel.tsx ── NEW: benefits + PaymentReceivedCard
                                  RETURNING: welcome + MonthCard
```

## Consequences

- Business owners see what they get, in plain terms, when they sign up. Returning users get a quiet welcome.
- Phone sign-ups see the three benefits without the form moving off-screen.
- The panel becomes a client component. It is small and is already in the `(auth)` client bundle through the pages.

## Alternatives considered

- **Per-route layouts for login and signup.** That duplicates the shell. One component with a variant is simpler.
- **Showing the full panel on phones.** It pushes the form below the fold. Rejected.
- **"No chargebacks" as a benefit.** It is a comparison, ruled out by the maintainer.

## Verification

- New tests go red, then green.
- `./scripts/preflight.sh` passes in full.
- Chrome on `/signup` and `/login` at 1440, 768 and 390, in light and dark, and with reduced motion. The bottom line is never clipped, and on phones the form is in the first screen.
