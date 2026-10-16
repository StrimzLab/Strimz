---
'@strimz/sdk': patch
'@strimz/sdk-react': patch
'@strimz/shared-types': patch
'@strimz/shared-config': patch
'@strimz/shared-crypto': patch
---

READMEs now match what each package exports. `@strimz/sdk-react` no longer mentions TanStack Query, and documents `useStrimzSession` returning `{ session, loading, error, refresh }`. The `@strimz/sdk` README documents the browser client's `checkout` and `tokens` namespaces, all error classes and `@strimz/sdk/eip712`. No code changes.
