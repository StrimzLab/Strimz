# Plan: split `apps/web` into five apps on Workers Free

Implements ADR-2026-11-14-split-web-into-workers. One branch (`chore/cloudflare-frontends`), one PR.

## Target layout

| App              | Port | Routes                                                                         | Providers                                                                                           |
| ---------------- | ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `apps/web`       | 3000 | `(marketing)`                                                                  | theme only                                                                                          |
| `apps/dashboard` | 3001 | `(auth)`, `(dashboard)`, `/api/uploadthing`, `/api/csp-report`                 | Privy, React Query, merchant API, Strimz SDK; loaded in the browser only                            |
| `apps/checkout`  | 3002 | `(checkout)`, `store`, `/api/csp-report`                                       | React Query, Strimz SDK, `CheckoutProviders` (wagmi, Reown); wallet tree loaded in the browser only |
| `apps/docs`      | 3003 | `docs/[[...slug]]`, `/api/search`; `/` redirects to `/docs`                    | Fumadocs                                                                                            |
| `apps/admin`     | 3004 | `(admin)`, `(admin-auth)`, `(admin-invite)`, `/api/admin/*`, `/api/csp-report` | Privy, React Query, admin API; loaded in the browser only                                           |

Each app gets:

- its own root `layout.tsx` (fonts, theme, toaster, metadata);
- `next.config.mjs`, `wrangler.jsonc`, `open-next.config.ts`;
- `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`;
- the `build:cloudflare`, `preview:cloudflare` and `deploy:cloudflare` scripts.

## Shared code: `packages/web-shared` (private, source only)

A file goes here when more than one app imports it after the provider split (measured with an import-closure script over `apps/web/src`). About 60 files:

- the merchant API client and resources;
- the admin API client;
- table, filter and page-header components;
- auth helpers: idle logout, auth redirect, submit button;
- `env`, `arc-network`, `format`, `seo`, `theme`, `logo`, `token-logo`, the odometer and GSAP helpers, `contact-topics`, `pricing-plans`;
- the session cache guard;
- the theme provider;
- the CSP report helper and `globals.css`.

How the package is wired:

- Apps import it as `@strimz/web-shared/<path>`. Each app maps that in `tsconfig.json` `paths` and in `vitest.config.ts`, and lists the package in `transpilePackages`.
- Inside the package, imports are relative.
- `packages/web-shared/next/security-headers.mjs` builds the baseline headers and the report-only CSP for each app's `next.config.mjs`. `frame-ancestors` is `'none'` everywhere except checkout (`*`, for embeds).

Files used by one app move into that app with their tests. Files no route imports (the mock `data/`, the unused agent-job components) stay with the dashboard, unchanged.

## Cross-app links

- New public env values, defaulting to the local ports:
  - `NEXT_PUBLIC_SITE_URL`;
  - `NEXT_PUBLIC_DASHBOARD_URL`;
  - `NEXT_PUBLIC_ADMIN_URL`;
  - `NEXT_PUBLIC_CHECKOUT_URL`;
  - `NEXT_PUBLIC_DOCS_URL`.
- `@strimz/web-shared/lib/site-urls` builds links from them.
- A link to a route owned by another app uses the helper, never a bare path.
- Guard test, `packages/web-shared/src/__tests__/cross-app-links.test.ts`: for each app, every `href="/..."` and `router.push('/...')` must target a route that app owns. It is written first and fails on the current tree.
- Marketing `next.config.mjs` redirects (308): `/login`, `/signup`, `/onboarding`, `/callback` and `/app/*` go to the dashboard; `/admin/*` to admin; `/pay/*`, `/sub/*` and `/store/*` to checkout; `/docs/*` to docs.

## Wallet code in the browser only

- Dashboard and admin mount their provider tree with `next/dynamic(..., { ssr: false })` from the root layout. The server renders the layout and a loading shell.
- Checkout does the same for `CheckoutProviders`.
- The marketing and docs layouts import no wallet or auth package.
- The size gate (below) verifies this.

## Removed

- `apps/web/src/middleware.ts`. It set `x-pathname`, which nothing reads any more; the comment in `providers.tsx` that mentions it is stale.

## Backend and SDK (test first)

| Change                                                                                                                                     | Failing test first                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Scheduler: required `CHECKOUT_ORIGIN`; the allowance-reminder `renewUrl` uses it                                                           | scheduler allowance-reminder unit test |
| API: required `STRIMZ_ADMIN_URL`; `inviteAcceptUrl` and the admin email `dashboardUrl`s use it. Merchant links keep `STRIMZ_DASHBOARD_URL` | API admin service and invite URL tests |
| `@strimz/sdk-react`: `DEFAULT_CHECKOUT_ORIGIN = 'https://checkout.strimz.finance'`, minor changeset                                        | sdk-react default-origin test          |
| `infra/lightsail/env.example`, local `.env.example` files: new values                                                                      | n/a                                    |

## Assets

Each app's `public/` gets only what it references: favicons, `manifest.json` and the logo in every app; the marketing art in `apps/web`; the network and token logos in checkout and dashboard. An asset-reference check in the smoke test (every `/…` image path a page requests returns 200) catches a missing file.

## Tests

- Unit tests move with the code they cover. Tests of shared code run in `packages/web-shared` (its own Vitest config).
- Playwright specs in `apps/web/tests/e2e` move to the app whose routes they visit.
- `scripts/worker-smoke.sh` gains `docs`, `dashboard`, `admin` and `checkout` route lists.
- `scripts/worker-size.sh <app>` fails above 3 MiB gzipped.
- CI workflows that name `@strimz/web` or `apps/web` paths are updated.

## Order of work

1. Backend and SDK changes, test first.
2. Create `packages/web-shared`; move the shared files; write the cross-app link test (red).
3. Carve out `apps/docs`, then `apps/checkout`, `apps/admin`, `apps/dashboard`; `apps/web` keeps marketing. Build each before the next.
4. Fix the cross-app links (green); add the marketing redirects.
5. Run `build:cloudflare`, smoke and size for all six Workers.
6. Full preflight and the API and scheduler e2e suites.
7. Runbook, release note, ship script.

## Done when

- Six Workers, each under 3 MiB gzipped (`worker-size.sh`).
- Every smoke route list passes on workerd.
- Preflight passes in full.
- The guard, scheduler, API and SDK tests pass.
- The runbook lists every Worker's build command, variables and secrets.
