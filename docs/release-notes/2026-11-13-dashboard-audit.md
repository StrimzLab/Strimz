---
date: 2026-11-13
feature: Eight dashboard fixes from the v1 audit, including a page for admin broadcasts
scope: fix
scenario-impact: none
---

# Dashboard audit fixes (#406)

Eight bugs found while auditing every dashboard page before the v1 end-to-end pass. Items 1 and 7 follow `docs/adr/ADR-2026-11-13-broadcast-page-and-dev-invites.md`.

## Broadcasts and notification links

**Broadcast page.** Admin broadcasts in the notification tray now open a page instead of a 404: `/app/notifications/[id]`.

- The page reads `GET /v1/notifications/broadcasts/:id`. It is dashboard-session only, and returns a broadcast sent to everyone or to the caller's merchant.
- The API cleans the HTML with `sanitize-html`. Formatting and `https`, `http` and `mailto` links are kept; scripts, event handlers, styles, images and other links are removed.

**Notification links.** Payment, subscription and refund notifications now jump to their row and outline it, through `?highlight=`.

## Small fixes

- **Transactions filter:** offers only the kinds the indexer records, one-time and subscription charge.
- **Storefront "View live" and URLs:** use this deployment's `NEXT_PUBLIC_APP_URL` instead of always `strimz.finance`.
- **Admin overview, analytics and merchant detail:** start in this deployment's mode, Test on testnet.
- **CCTP routing:** marked unavailable in `@strimz/shared-config`, so `PATCH /v1/agents/config` refuses it. It arrives with the Whisk integration.
- **Example config:** the scheduler and web `.env.example` files point at the real Arc testnet RPC.
- **Admin invites without email:** outside production, the invite and resend-invite responses include `acceptUrl`, and the admins page shows it with a copy button. `STRIMZ_DASHBOARD_URL` is now in the API `.env.example`.
- **Settings → Security:** describes sign-in as it works (email, Google or wallet through Privy). The false 2FA claims and the privy.io link are gone, and the first-run checklist no longer says live mode needs MFA.

## Follow-up

#443: move the broadcast email onto the same HTML allowlist.
