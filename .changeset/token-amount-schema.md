---
'@strimz/shared-types': patch
---

`tokenAmountSchema.safeParse` now returns a validation error for a malformed amount such as `"1.5"`, `"1e6"` or `"abc"` instead of throwing `SyntaxError: Cannot convert ... to a BigInt`. The redundant `BigInt(v) >= 0n` refine is removed; the base-10 digits regex already accepts only non-negative integers. The inferred type is still `string`; the exported schema is now a plain `ZodString` rather than a `ZodEffects` wrapper.
