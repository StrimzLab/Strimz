---
date: 2026-10-04
feature: Secret keys are refused in browsers, and the public checkout routes answer every origin
scope: fix
scenario-impact: none
---

# Secret keys stay on the server; checkout routes open to every origin

`StrimzClient` from `@strimz/sdk` now refuses to start in a browser, so a secret key in
frontend code fails at once with a clear error instead of a CORS error on the first
call. The API's CORS policy is split in two: the public checkout and token routes answer
browsers on any website, so `@strimz/sdk-react` and `StrimzBrowserClient` work on
merchant domains in production for the first time. Every other route still answers only
the allowlisted Strimz origins.

Closes #136. ADR: [ADR-2026-10-03-browser-keys-cors](../adr/ADR-2026-10-03-browser-keys-cors.md)
([plain-English version](../adr/ADR-2026-10-03-browser-keys-cors-for-dummies.md)).

## What was wrong

- A tester called `paymentSessions.create` with a secret key from browser React code and
  got a CORS error from `api.strimz.finance`. Nothing told them the key did not belong
  in a browser.
- One CORS policy covered every route and only allowed origins in `CORS_ORIGIN`. Browsers
  on merchant domains could not reach the public `/v1/checkout/*` and `/v1/tokens/*`
  routes that the browser SDK exists to call.
- The e2e test app registered no CORS policy, so no test could observe CORS.
- The docs said a publishable key could create payment sessions. No route accepts one.

## What shipped

- `@strimz/sdk` (minor, **breaking**): `StrimzClient` throws `StrimzAuthenticationError`
  with code `secret_key_in_browser` in a browser page, a web worker, an Electron
  renderer or React Native. Node (including jsdom and happy-dom test environments),
  Deno, Bun, Vercel Edge, Cloudflare Workers and unknown runtimes are servers. The
  message links to the new docs page and never contains the key. There is no opt-out.
- `@strimz/sdk`: `secret_key_in_browser` is a new member of `StrimzErrorCode`. An
  exhaustive `switch` over it needs a new case.
- API: the CORS policy lives in `apps/api/src/common/http/cors-policy.ts` and is used by
  both `main.ts` and the e2e test app. It is a `@fastify/cors` delegator that picks the
  group from the request path:
  - Paths under `/v1/checkout/` and `/v1/tokens/`: `Access-Control-Allow-Origin: *`, no
    credentials, GET, HEAD, POST and OPTIONS, the SDK headers, preflight cached for
    7200 seconds.
  - Every other path: the request origin is reflected only when it is in `CORS_ORIGIN`,
    with credentials, `Vary: Origin`, the same methods and headers as before, preflight
    cached for 600 seconds. Any other origin gets no CORS headers.
- API: an e2e test fails if a route under `/v1/checkout/` or `/v1/tokens/` is not
  `@Public()`.
- API: a publishable key on a secret-key route still gets `401 authentication_error`,
  now with the message "publishable keys can only call /v1/checkout and /v1/tokens; use
  a secret key from your server".
- Docs: new page `checkout/server-sessions` (Next.js and Express examples and "Seeing a
  CORS error?"); updates to `sdks/server`, `errors`, `authentication`, `glossary`,
  `dashboard/api-keys` and `sdks/react`.

## Deploy

No env change is needed. `CORS_ORIGIN` keeps its name, its value on Lightsail, and its
production rule (boot fails when it is `*`). Its meaning narrows: it now lists the
origins allowed on every route except `/v1/checkout/*` and `/v1/tokens/*`, which answer
every origin whatever it says. Keep it set to the Strimz web app origin.

## Not in this change

- Publishable keys are still not validated by the API. Validating them, and
  per-merchant allowed origins, are left for a follow-up ADR.
- `/store/*` stays allowlisted.
