---
'@strimz/shared-types': minor
'@strimz/sdk': minor
---

Add the API key scopes `merchants_read`, `customers_read`, `customers_write` and `analytics_read` to `apiKeyScopeSchema`. The API now rejects an API key on any route that does not name a scope it holds, so `strimz.merchants.me()` needs `merchants_read`, the customers routes need `customers_read` or `customers_write`, `/v1/stats/*` needs `analytics_read`, and the storefront routes need `storefronts_read` or `storefronts_write`.

Deprecated: `strimz.merchants.update()` and `strimz.merchants.changeTier()`. `PATCH /v1/merchants/me` and `POST /v1/merchants/me/tier` now accept only a dashboard session and return 403 `permission_denied` to every API key. Both methods will be removed in the next minor release.
