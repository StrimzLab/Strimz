---
'@strimz/sdk': patch
---

`transactions.list` and `agents.listActivity` date filters now work: `from` (inclusive) and `to` (exclusive) take ISO-8601 timestamps with a time zone. The API used to reject them with 400.
