---
date: 2026-11-12
feature: Emails and the site use strimz.finance instead of the Vercel address
scope: fix
scenario-impact: none
---

# strimz.finance links

Emails loaded the Strimz logo from `strimz-finance.vercel.app`, and their buttons fell back
to that address when `STRIMZ_DASHBOARD_URL` wasn't set. The logo, the fallback dashboard
links, the payment-received preview and the web app's `metadataBase` (used for share images)
now use `https://strimz.finance`.

The logo only shows once `strimz.finance` serves the web app: on 2026-11-12 both addresses
answered `402 DEPLOYMENT_DISABLED` from Vercel. Emails already sent keep the old address.

The admin proxy still accepts requests from the Vercel address alongside `strimz.finance`.
