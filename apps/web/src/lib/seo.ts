/**
 * Shared SEO constants for Open Graph and Twitter cards.
 *
 * The OG image is `public/thumbnail.png` (1200×630, the standard OG
 * card aspect). Defined here so the file path and dimensions live in
 * one place — every per-page `openGraph` override in the app pulls
 * from this constant rather than hard-coding the path.
 *
 * Why this matters: Next.js does NOT deep-merge the `openGraph` field.
 * If a child segment exports its own `openGraph`, it replaces the
 * parent's entirely (not field-by-field). So any page that overrides
 * `openGraph` to set a custom title/description must also include
 * `images`, or the inherited image is lost.
 */

export const OG_IMAGE = {
  url: '/thumbnail.png',
  width: 1200,
  height: 630,
  alt: 'Strimz — the billing layer for stablecoins. One API for one-time payments and recurring subscriptions, settled in USDC on Arc.',
} as const

/** Twitter accepts a string-or-array; we expose the bare URL for that field. */
export const TWITTER_IMAGE = OG_IMAGE.url
