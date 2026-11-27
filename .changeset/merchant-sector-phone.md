---
'@strimz/shared-types': minor
---

`Merchant` now includes `businessSector` and `phone`, as given at onboarding (both nullable). `GET /v1/merchants/me` returns them, so the dashboard can copy a merchant's details into their test account.
