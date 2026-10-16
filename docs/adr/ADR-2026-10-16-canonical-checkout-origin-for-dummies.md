# ADR for Dummies: The React SDK uses www.strimz.finance

- **Status:** Accepted (approved by the maintainer, 2026-10-16)
- **Date:** 2026-10-16

## The Idea

Our website lives at `www.strimz.finance`. If you go to `strimz.finance`, you are forwarded
to `www`. Our React SDK still points at `strimz.finance`, so the checkout opens on `www`. When the
payment finishes, the checkout tells the merchant's page "it worked", but the SDK expects that
message from `strimz.finance` and throws it away. So a merchant using the default settings
never hears that the payment went through.

## What Changes

1. The SDK points at `www.strimz.finance` by default.
2. If a merchant sets the checkout address themselves, it must be just the address
   (`https://www.strimz.finance`). A slash on the end is fine. Anything after it, like
   `/pay`, is rejected with a clear error straight away. Today that mistake silently breaks
   the popup.
3. The docs and README show the new default. The "known bug" note goes away.
4. Our API server should use the same `www` address when it builds checkout links. That is
   one setting on the server, which you change.

## Why not make `strimz.finance` the main address instead?

That would fix old SDK versions without a release. But every doc and example now says `www`,
and merchants who followed the README would break instead. One address everywhere is simpler.

## Important Limitation

Merchants already on SDK version 0.3.0 with default settings stay broken until they upgrade to
the new patch version or add one line to their settings. 0.3.0 came out today, so very few, if
any, are affected.

## What Does Not Change

The website, the checkout pages, the database and the contracts.
