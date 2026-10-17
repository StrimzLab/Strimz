---
date: 2026-10-17
feature: The SDK sends its real version in X-Strimz-Sdk-Version
scope: fix
scenario-impact: none
---

# SDK version header

Fixes #296. ADR: `docs/adr/ADR-2026-10-17-sdk-version-header.md` (and the for-dummies companion).

## What shipped

- `@strimz/sdk` sends its `package.json` version as `X-Strimz-Sdk-Version` from `StrimzClient` and `StrimzBrowserClient`. tsup and vitest set it at build time, so each release reports its own version with no manual step.
- Versions published before this fix keep sending `0.0.0`.

## Operator steps

None. The fix reaches merchants with the next `@strimz/sdk` release.
