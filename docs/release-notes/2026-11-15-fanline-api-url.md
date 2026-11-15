---
date: 2026-11-15
feature: Fanline keeps its API URL across redeploys
scope: demo-merchant
scenario-impact: none
---

# Fanline keeps its API URL across redeploys

- **`STRIMZ_API_URL` now lives in Fanline's `wrangler.jsonc`.** It was missing, so tips and Pro sign-ups failed with "HTTP 403". Adding it in the Cloudflare dashboard fixed the live site, but a redeploy from GitHub drops dashboard-only variables, so the value now ships with the code.
- **The Pro card's error message** is readable in both themes.
