---
date: 2026-11-23
feature: Inline scripts work on every Worker (no more "__name is not defined")
scope: fix
scenario-impact: none
---

# Inline scripts work on every Worker

Issue: #553.

The dashboard, admin and checkout threw `ReferenceError: __name is not defined` on every load. Wrangler's esbuild wrapped functions in `__name()`, which inline `<script>`s can't reach. Two scripts broke:

- **the theme script,** so the page flickered or painted in the wrong theme. This is the glitchy admin sign-in;
- **the stale-asset reload guard,** so a tab left open across a deploy could stay stuck on old files.

## What changed

- Every app's `wrangler.jsonc` sets `"keep_names": false`, as Fanline already did (#469).
- A test checks that every Worker config sets it.

## Verified

- An admin build served on workerd (`wrangler dev`) has no `__name(` calls; the live site has five.
- The theme script is present and intact.
- `./scripts/preflight.sh` passed in full.
