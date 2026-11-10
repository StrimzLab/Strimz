---
date: 2026-11-10
feature: Coming soon badges on dashboard features that aren't live in v1
scope: feat
scenario-impact: none
---

# Coming soon badges

Merchants no longer hit dashboard controls that do nothing. Each one now carries a
"Coming soon" badge and can't be used yet (#405):

- **Settings → Team:** no API reference to a route that doesn't exist.
- **Settings → Danger zone:** the unbound textarea and the toast-only button are gone;
  the section tells merchants to email support to delete their account.
- **Agents → Identity:** "Managed" and the hardcoded "Active" are replaced, and the copy
  no longer says every other capability depends on it.
- **Webhooks → Add endpoint:** `compliance.wallet_flagged` and `compliance.wallet_blocked`
  show disabled. Nothing emits them yet.
- **Agents → Recovery settings → Grace period:** disabled. Reminders run on a fixed
  schedule, and each plan's own grace period decides when a subscription lapses.

One `ComingSoonBadge` component (`apps/web/src/components/dashboard/coming-soon-badge.tsx`)
is used everywhere, including Commerce and CCTP routing, which were already badged.

No API, schema or webhook payload change. `selectableWebhookEvents` leaves out the
compliance events; `webhook-events.test.ts` was red first.
