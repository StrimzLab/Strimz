---
'@strimz/sdk': minor
---

**Breaking:** `StrimzClient` now refuses to start in a browser runtime. Constructing it with a secret key in a browser page, a web worker, an Electron renderer or React Native throws `StrimzAuthenticationError` with code `secret_key_in_browser` and no `httpStatus`. The message links to https://strimz.finance/docs/checkout/server-sessions and never contains the key. There is no option to turn the check off. Node (including test environments with jsdom or happy-dom), Deno, Bun, Vercel Edge, Cloudflare Workers and unrecognised runtimes are unaffected. Create payment sessions on your server and pass the session id to the browser.

- New error code: `secret_key_in_browser` is added to `StrimzErrorCode`. An exhaustive `switch` over `StrimzErrorCode` needs a case for it.
- The `X-Strimz-Sdk-Runtime` header now reports `deno`, `bun`, `workerd` or `electron-renderer` where it used to report `unknown` or `browser`.
- `StrimzBrowserClient` is unchanged.
