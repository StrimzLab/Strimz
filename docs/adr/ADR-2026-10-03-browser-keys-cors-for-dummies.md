# ADR for Dummies: Keep secret keys off websites, and let the safe calls through

- **Status:** Accepted 2026-10-04
- **Date:** 2026-10-03

## The Idea

Every Strimz merchant has a secret key that can create charges and read their data. It
must live on the merchant's server, never in the website code that shoppers download.
We propose two changes. First, the Strimz SDK refuses to start with a secret key when
it notices it is running inside a web page or a phone app, and says how to fix it.
Second, the Strimz API lets any website make the handful of harmless checkout calls
(showing a payment's status, reading token details), while every call that needs a
secret key keeps refusing websites it does not know.

## What the Person Sees

1. A developer puts the secret key in their website code by mistake. Instead of a
   confusing "CORS" error, the page shows "secret keys must stay on your server" with
   a link to the guide.
2. The guide shows the right pattern: the merchant's server creates the payment and
   hands the website only a payment id.
3. The merchant's website shows Strimz checkout and its live status using the
   browser-safe key, from the merchant's own domain. Today that only works from the
   Strimz website itself.
4. If anyone's website tries to call a secret-key action directly, the browser blocks
   it, as it does today.

## Important Limitation

- The SDK check is a seat belt, not a lock. Once a secret key is in website code,
  anyone can copy it, whether or not the SDK starts. The check stops the mistake from
  feeling like it works; it cannot un-leak a key. A leaked key must be revoked.
- The browser-safe ("publishable") key is not actually checked by the Strimz servers
  today. It only tells the SDK whether it is in test or live mode. Making the servers
  check it, and letting each merchant list the websites allowed to use it, is a
  separate decision for later.
- The browser rules only apply to browsers. A script on any computer can still call
  the public checkout endpoints, as it always could.

## What Changes

- The SDK stops with a clear error when a secret key is used in a web page, a browser
  worker, a React Native app or an Electron window.
- Websites on any domain can read checkout and token information from the Strimz API.
- The browser caches the API's permission answer for longer, so pages make fewer
  extra requests.
- New guide: "Create payment sessions on your server". The docs stop saying the
  browser-safe key can create payments, because it cannot.
- The SDK version goes up one step (0.7 to 0.8) and the release note calls the change
  breaking.

## What Does Not Change

- Server code using the secret key (Node, Deno, Bun, Vercel Edge, Cloudflare Workers)
  works as before, including test suites that simulate a browser.
- The Strimz dashboard, hosted checkout and storefronts work as before.
- Which websites may use secret-key endpoints stays the same list we configure today.
- No database, smart contract, webhook or payment flow change.
