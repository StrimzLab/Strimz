# Frontends on Cloudflare Workers

The web frontends run on Cloudflare Workers Free through OpenNext (`@opennextjs/cloudflare`), one Worker per app, built by Workers Builds from `main` (ADR-2026-11-14-split-web-into-workers).

| App                  | Workspace               | Worker             | Domain                                                 |
| -------------------- | ----------------------- | ------------------ | ------------------------------------------------------ |
| `apps/web`           | `@strimz/web`           | `strimz-web`       | `strimz.finance`; `www.strimz.finance` redirects to it |
| `apps/docs`          | `@strimz/docs`          | `strimz-docs`      | `docs.strimz.finance`                                  |
| `apps/dashboard`     | `@strimz/dashboard`     | `strimz-dashboard` | `app.strimz.finance`                                   |
| `apps/admin`         | `@strimz/admin`         | `strimz-admin`     | `admin.strimz.finance`                                 |
| `apps/checkout`      | `@strimz/checkout`      | `strimz-checkout`  | `checkout.strimz.finance`                              |
| `apps/demo-merchant` | `@strimz/demo-merchant` | `strimz-fanline`   | `fanline.strimz.finance`                               |

- The Worker name in the dashboard must equal `name` in the app's `wrangler.jsonc`, or a deploy goes to the wrong Worker.
- Code used by more than one app lives in `packages/web-shared`. Apps import it as `@strimz/web-shared/...`.
- Links to another app's routes go through `siteUrls` (`@strimz/web-shared/lib/site-urls`). `packages/web-shared/src/__tests__/cross-app-links.test.ts` fails on a bare path to another app.

## Build and check locally

From the repo root, for any app:

```bash
pnpm install
pnpm turbo run build --filter='@strimz/dashboard^...'
pnpm --filter @strimz/dashboard build:cloudflare
scripts/worker-smoke.sh dashboard     # web, docs, dashboard, admin, checkout, fanline
scripts/worker-size.sh dashboard      # fails above 3 MiB gzipped
```

`next build` passing proves nothing about the Workers runtime. The smoke test serves the build on workerd (`wrangler dev`) and requests the main routes. Run both scripts after any change to rendering, `next.config`, providers or dependencies.

Local dev ports: web 3000, dashboard 3001, checkout 3002, docs 3003, admin 3004, Fanline 3200. Each app reads its own `.env` (copy its `.env.example`).

## Limits (Workers Free)

- 3 MiB gzipped per Worker. Measured 2026-11-14:

  | Worker             | gzipped |
  | ------------------ | ------- |
  | `strimz-web`       | 1.3 MiB |
  | `strimz-docs`      | 1.3 MiB |
  | `strimz-admin`     | 1.4 MiB |
  | `strimz-checkout`  | 2.2 MiB |
  | `strimz-dashboard` | 2.5 MiB |
  | `strimz-fanline`   | 0.9 MiB |

- 10 ms CPU per request and 100,000 requests a day across the account.
- No Images binding: every app sets `images.unoptimized`. Size images in the repo before adding them.
- Server-side `fetch` can't target a bare IP. Use hostnames.

Dashboard and admin load Privy only in the browser (`client-providers.tsx`, `ssr: false`), and their server build replaces `@privy-io/react-auth` with a stub (`browserOnly` in `packages/web-shared/next/base-config.mjs`). Rendering a Privy hook outside that provider tree throws on the server.

## Workers Builds settings

Workers & Pages → Create → Import a repository → `StrimzLab/Strimz`, once per Worker:

| Setting           | Value                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Production branch | `main`                                                                                                                |
| Root directory    | `/` (repo root)                                                                                                       |
| Build command     | `pnpm install --frozen-lockfile && pnpm turbo run build --filter='<pkg>^...' && pnpm --filter <pkg> build:cloudflare` |
| Deploy command    | `cd apps/<dir> && pnpm exec opennextjs-cloudflare deploy`                                                             |

`<pkg>` is the workspace from the table above (for example `@strimz/checkout`), `<dir>` its folder (`checkout`).

## Variables

`NEXT_PUBLIC_*` values are inlined by `next build`, so they're **build variables** (Settings → Build → Variables and secrets). Server-only values are **Worker secrets** (Settings → Variables and secrets). A secret never gets a `NEXT_PUBLIC_` prefix.

Every Worker except Fanline takes the five app origins:

```
NEXT_PUBLIC_SITE_URL=https://strimz.finance
NEXT_PUBLIC_DASHBOARD_URL=https://app.strimz.finance
NEXT_PUBLIC_CHECKOUT_URL=https://checkout.strimz.finance
NEXT_PUBLIC_DOCS_URL=https://docs.strimz.finance
NEXT_PUBLIC_ADMIN_URL=https://admin.strimz.finance
```

Each Worker also needs:

- **`strimz-web`:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_ARC_ENVIRONMENT`, `NEXT_PUBLIC_ARC_RPC_URL`.
- **`strimz-docs`:** nothing more.
- **`strimz-dashboard`:**
  - build: `NEXT_PUBLIC_APP_URL=https://app.strimz.finance`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_ARC_ENVIRONMENT`, `NEXT_PUBLIC_ARC_RPC_URL`, `NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY`;
  - secret: `UPLOADTHING_TOKEN`.
- **`strimz-admin`:** `NEXT_PUBLIC_APP_URL=https://admin.strimz.finance`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_ARC_ENVIRONMENT`, `NEXT_PUBLIC_ARC_RPC_URL`.
- **`strimz-checkout`:**
  - `NEXT_PUBLIC_APP_URL=https://checkout.strimz.finance`;
  - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ARC_ENVIRONMENT`, `NEXT_PUBLIC_ARC_RPC_URL`;
  - `NEXT_PUBLIC_REOWN_PROJECT_ID`, `NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY`;
  - `NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS`, `NEXT_PUBLIC_STRIMZ_SUBSCRIPTIONS_ADDRESS`, `NEXT_PUBLIC_STRIMZ_USDC_ADDRESS`.
- **`strimz-fanline`:**
  - build: `NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIMZ_CHECKOUT_ORIGIN=https://checkout.strimz.finance`, `NEXT_PUBLIC_FANLINE_URL=https://fanline.strimz.finance`;
  - runtime variable: `STRIMZ_API_URL=https://api.strimz.finance`;
  - secret: `STRIMZ_SECRET_KEY`.

`NEXT_PUBLIC_APP_URL` is the app's own origin. Admin's API forwards check requests against it, and checkout shows it to wallets.

## API, Privy and Turnstile

- **API** (`infra/lightsail/env.example`):
  - `CHECKOUT_ORIGIN=https://checkout.strimz.finance`. The scheduler reads it too, for allowance-renewal links.
  - `STRIMZ_DASHBOARD_URL=https://app.strimz.finance`.
  - `STRIMZ_ADMIN_URL=https://admin.strimz.finance`.
  - `CORS_ORIGIN=https://strimz.finance,https://app.strimz.finance,https://admin.strimz.finance,https://checkout.strimz.finance`.
- **Privy:** allowed origins `https://app.strimz.finance` and `https://admin.strimz.finance`.
- **Turnstile:** the widget's hostnames include `strimz.finance` (contact form).

## Domains

Attach domains in the Worker's **Settings → Domains & Routes → Add → Custom domain**. Cloudflare creates the DNS record and replaces an existing `A` or `CNAME` with the same name. Do this only after the `*.workers.dev` URL has been checked.

`www.strimz.finance` gets a redirect rule to `https://strimz.finance` (Rules → Redirect Rules), keeping the path. Old `www.strimz.finance/pay/...` links then reach the marketing Worker, which sends them on to checkout.

## Manual deploy

```bash
git checkout main && git pull && pnpm install
pnpm turbo run build --filter='@strimz/checkout^...'
pnpm --filter @strimz/checkout build:cloudflare
cd apps/checkout && pnpm exec opennextjs-cloudflare deploy
```
