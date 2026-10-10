---
date: 2026-10-10
feature: Every public API route has a per-address rate limit, and the client address comes from the local proxy only
scope: fix
scenario-impact: needs_automation
---

# Public endpoint hardening, part 1: rate limits and the client address

Every API route without a guard now declares its own per-address rate limit, token
metadata reads are cached for 10 minutes, and the address those limits count against is
the one the host proxy saw, not one the client wrote into `X-Forwarded-For`.

Part 1 of 5 for #133. ADR:
[ADR-2026-10-10-public-endpoint-hardening](../adr/ADR-2026-10-10-public-endpoint-hardening.md)
([plain-English version](../adr/ADR-2026-10-10-public-endpoint-hardening-for-dummies.md)).

## What was wrong

- Thirteen public routes had only the global limit of 600 requests a minute per address:
  the payer attach routes, the contact form, token metadata, the storefront page and its
  checkout, the checkout reads, `POST /v1/auth/sync` and `POST /v1/auth/turnstile/verify`.
  One token metadata read costs up to six RPC calls, so one address could spend up to
  3,600 RPC reads a minute; one contact submission sends one email.
- The API ran with `trustProxy: true`, so `req.ip` was the left-most `X-Forwarded-For`
  entry, and the container's nginx appended to whatever header arrived. Every per-address
  limit was only as safe as the host Caddyfile, which is not in the repository.
- `deploy.sh` published the container port on every interface.

## What shipped

- `@RateLimit` on every unguarded route, per address (ADR D3):

  | Route                                            | Limit                                       |
  | ------------------------------------------------ | ------------------------------------------- |
  | `POST /v1/auth/sync`                             | 30 a minute                                 |
  | `POST /v1/contact`                               | 5 an hour                                   |
  | `GET /v1/checkout/merchants/:id`                 | 120 a minute                                |
  | `GET /v1/checkout/sessions/:id`                  | 120 a minute                                |
  | `GET /v1/checkout/plans/:id`                     | 120 a minute                                |
  | `GET /v1/checkout/plans/:id/subscription`        | 60 a minute                                 |
  | `GET /v1/checkout/plans/:id/terms`               | 60 a minute                                 |
  | `POST /v1/checkout/sessions/:id/payer`           | 10 a minute                                 |
  | `POST /v1/checkout/plans/:id/payer`              | 10 a minute                                 |
  | `GET /v1/tokens/:address`                        | 60 a minute                                 |
  | `GET /store/:slug`                               | 120 a minute                                |
  | `POST /store/:slug/products/:productId/checkout` | 10 a minute                                 |
  | `POST /v1/auth/turnstile/verify`                 | 30 a minute, until part 4 removes the route |

  `/health`, `/ready` and the signed Privy webhook keep only the global limit. A test
  lists every unguarded handler and fails when one has no `@RateLimit`.

- `TokensService.getMetadata` keeps a whitelisted token's metadata in process memory for
  10 minutes, keyed by the lowercase address (D9). A `404 token_not_whitelisted` is not
  cached.
- The API trusts forwarding headers only from the local nginx:
  `trustProxy: TRUSTED_PROXIES` (`127.0.0.1`, `::1`) from
  `apps/api/src/common/http/trust-proxy.ts` (D4). A request from any other peer keeps its
  socket address.
- The container's nginx resolves the client with the realip module
  (`set_real_ip_from 172.17.0.1`, `real_ip_header X-Forwarded-For`,
  `real_ip_recursive off`, so the right-most entry, the one Caddy wrote) and forwards that
  single address with `X-Forwarded-For $remote_addr` instead of appending (D4).
- `deploy.sh` publishes the container on `127.0.0.1` whenever `HTTP_PORT` is not 80; the
  new `BIND_ADDR` variable overrides it (D5). `infra/lightsail/README.md` explains the
  binding and the Caddy check.

## API behaviour change

- The routes above answer `429 rate_limited` with `retryAfterSec` once an address passes
  its limit. The buckets live in the API process and reset on restart.
- `@strimz/sdk` reads `/v1/tokens/:address` once or twice per checkout; a client that
  reads it more than 60 times a minute from one address gets `429`.

## Not in this part

- Part 2: payer binding (open sessions only, first wallet wins, never replace a known
  email).
- Part 3: Turnstile on the contact form, `502` when email delivery fails.
- Part 4: signup bot check moves into Privy; `POST /v1/auth/turnstile/verify` is removed.
- Part 5: compliance screening stays off explicitly, and the docs say so.

Until each part is deployed, production keeps the gaps it fixes.

## Deploy

The API runs on Lightsail and is redeployed by hand. The maintainer is deferring the
redeploy until the launch fixes are done, so production keeps the old limits and the
old client address until then. The nginx and API changes ship in the same image
(`Dockerfile.lightsail` copies `nginx.conf`), so they cannot be deployed apart. No
migration, no new env var.

Operator steps for this part, from the ADR:

1. On the Lightsail host, show the Caddy site block for `api.strimz.finance`
   (`sudo cat /etc/caddy/Caddyfile`) and `caddy version`. Confirm there is no
   `trusted_proxies` and no `header_up X-Forwarded-For` (or `X-Real-IP`). Caddy must be
   v2.x with the documented default; send the block to the pull request for the record.
2. Before the redeploy, inside the new container,
   `nginx -V 2>&1 | tr ' ' '\n' | grep realip` shows `--with-http_realip_module`, and on
   the host `docker network inspect bridge -f '{{(index .IPAM.Config 0).Gateway}}'`
   prints `172.17.0.1`. If not, change `set_real_ip_from` before deploying.
3. Redeploy with `deploy.sh` (it now binds `127.0.0.1:8080`), then from outside run
   `curl -s https://api.strimz.finance/health -H 'X-Forwarded-For: 6.6.6.6'`; the access
   line in `docker logs strimz` must show the real client address, not `6.6.6.6`.

## Scenario impact

`needs_automation`: covered by API e2e and unit tests and an nginx container check;
`docs/scenarios/` has no scenario to update. The `main.ts` wiring and the production
proxy chain are checked by hand after the redeploy (operator step 3), and on Arc testnet
a burst of 11 payer attaches from one machine must see `429`.
