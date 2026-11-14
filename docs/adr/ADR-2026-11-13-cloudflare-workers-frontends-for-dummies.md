# ADR for Dummies: Move the Strimz website and the demo shop to Cloudflare

- **Status:** Superseded by ADR-2026-11-14-split-web-into-workers
- **Date:** 2026-11-13

## The Idea

The Strimz website (with the docs, the dashboard and the checkout pages) and the Fanline demo shop used to run on Vercel. We're moving them to Cloudflare, where the domain already lives. Solva already runs its websites there the same way.

## What the Person Sees

1. `strimz.finance` and `www.strimz.finance` show the same site as before, now served by Cloudflare.
2. The demo shop moves to `fanline.strimz.finance`.
3. When we merge a change to `main`, Cloudflare rebuilds and publishes the site by itself, as Vercel did.

## Important Limitation

Cloudflare's free plan only accepts a site up to a certain size. Our website carries a lot (wallet connection, sign-in, the docs), so it may be too big for the free plan. We measure it first. If it doesn't fit, the paid plan costs $5 a month, and you decide.

Images on the site are shown as they are, without Cloudflare resizing them on the fly. They're already small enough.

## What Changes

- Where the website and the demo shop are hosted.
- A small Next.js update that Cloudflare needs.
- A short guide for deploying and checking the site.

## What Does Not Change

- The pages, the checkout, the dashboard and the docs.
- The backend, the contracts and the payment flows.
