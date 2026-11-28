---
date: 2026-11-28
feature: Admin Test / Live switch
scope: feat
scenario-impact: none
---

# Admin Test / Live switch

Step 5 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#580).

## What admins see

- **A Test / Live switch** in the admin top bar, and a banner in Test saying it shows the test backend only.
- **Everything follows it:**
  - overview, merchants, merchant detail and analytics;
  - the audit log;
  - the Safe console;
  - every write (suspend, tier, invites, broadcasts).

  Test and live data never share a cache.

- **One switch instead of three.** The old per-page "Mode" toggles on the overview, analytics and merchant detail are gone. They only filtered rows inside the live backend, so Test always showed empty.
- **The Safe console in Test** says it isn't configured: testnet has no Safe (2026-11-27 amendment).

## Under the hood

- **Reads:** `AdminApiClient` takes the selected network and reads from its API.
- **Writes:** they go through admin's own routes with an `x-strimz-mode` header. `adminUpstreamBase` maps that to the matching backend from the build's settings, so the browser can never choose an upstream URL. A mode the build doesn't have gets `400 mode_unavailable`.
- **Shared components:** the switch and banner moved to `web-shared`, so the dashboard and admin share them.
- **Super admin:** the founder is bootstrapped on the test backend (2026-11-28). Other admins are invited from admin while it's in Test.
- **Runbook:** `docs/runbooks/cloudflare-workers.md` lists admin's test build variables.
