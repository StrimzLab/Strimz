---
'@strimz/sdk-react': minor
---

`StrimzCheckoutEmbed` accepts an optional `theme` prop (`'light'` or `'dark'`) that pins the embedded checkout's colour scheme. Without it the embedded checkout now follows the payer's system light or dark preference instead of always rendering light; pass `theme="light"` to keep the previous look.
