---
date: 2026-11-14
feature: Web app split into five apps on Cloudflare Workers Free
scope: chore
scenario-impact: none
---

# Five web apps on Cloudflare Workers

The single web app was 5.7 MiB as a Worker; Workers Free allows 3 MiB. It is now five apps, each on its own free Worker. See `docs/adr/ADR-2026-11-14-split-web-into-workers.md` and `docs/runbooks/cloudflare-workers.md`.

| Address                   | App              | Worker size (gzipped) |
| ------------------------- | ---------------- | --------------------- |
| `strimz.finance`          | `apps/web`       | 1.3 MiB               |
| `docs.strimz.finance`     | `apps/docs`      | 1.3 MiB               |
| `app.strimz.finance`      | `apps/dashboard` | 2.5 MiB               |
| `admin.strimz.finance`    | `apps/admin`     | 1.4 MiB               |
| `checkout.strimz.finance` | `apps/checkout`  | 2.2 MiB               |
| `fanline.strimz.finance`  | Fanline demo     | 0.9 MiB               |

- **Old addresses redirect.** `strimz.finance/login`, `/app/...`, `/admin/...`, `/pay/...`, `/sub/...`, `/store/...` and `/docs/...` go to the new hosts, with the same path.
- **Privy loads only in the browser** on the dashboard and admin, and is kept out of their Workers.
- **Shared code** lives in `packages/web-shared`. Cross-app links use `siteUrls`, and a test fails on a bare path to another app.
- **API and scheduler:**
  - admin invite and admin email links use the new required `STRIMZ_ADMIN_URL`;
  - the allowance-renewal email links to the checkout host (`CHECKOUT_ORIGIN`, now required by the scheduler);
  - the merchant dashboard link default is `https://app.strimz.finance`.
- **SDK:** `@strimz/sdk-react` defaults `checkoutOrigin` to `https://checkout.strimz.finance`.
- **Docs pages** show the new checkout, storefront and sign-up addresses.
- **Next.js** is `^15.5.29` (OpenNext's minimum).
- **Size gate:** `scripts/worker-smoke.sh <app>` and `scripts/worker-size.sh <app>` check each Worker on workerd and against the 3 MiB limit.
