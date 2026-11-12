/**
 * Shared design tokens for Strimz transactional emails.
 *
 * Email clients (especially Outlook + Gmail's mobile apps) have huge
 * gaps in CSS support, so React Email + inline styles is the only
 * portable path. These tokens live in one place so a brand change is
 * one diff, not 12 templates updated by hand.
 *
 * Palette intent:
 *   - White outer canvas: renders cleanly inside both light and dark
 *     mail clients without forcing a theme. Strimz brand colour lives
 *     inside the card.
 *   - One dominant accent (#02C76A): used for the status pill, primary
 *     CTA, and the underline on inline links. A single accent keeps the
 *     emails feeling on-brand without becoming a colour swatch.
 *   - Neutral muted text for body copy: optimised for scannability.
 *     The body of every transactional email is "you can stop reading
 *     after the first line" — the colour ramp supports that.
 */
export const colors = {
  // Backgrounds
  page: '#F8F9FB',
  card: '#FFFFFF',
  cardBorder: '#E5E7EB',
  detailBg: '#F9FAFB',

  // Text
  foreground: '#050020',
  muted: '#58556A',
  subtle: '#8B8896',

  // Brand
  primary: '#02C76A',
  primarySoft: 'rgba(2, 199, 106, 0.10)',
  primaryBorder: 'rgba(2, 199, 106, 0.30)',
  link: '#02C76A',

  // Status
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.08)',
  dangerBorder: 'rgba(220, 38, 38, 0.30)',
} as const

export const radii = {
  card: '12px',
  detail: '8px',
  pill: '999px',
} as const

export const fonts = {
  body: '"Poppins", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

// Sent emails keep this URL, so the logo must stay at this path on the site.
export const LOGO_URL = 'https://strimz.finance/logo/blueLogo.png'

/** Where reply-to / contact links go. The Strimz operations mailbox. */
export const SUPPORT_EMAIL = 'support@strimz.finance'

/** The brand-facing URL shown in email footers and signature lines. */
export const STRIMZ_BRAND_URL = 'https://strimz.finance'

/** Human-readable brand-display host (no scheme), e.g. for footer text. */
export const STRIMZ_BRAND_DISPLAY = 'strimz.finance'

/** Fallback origin for CTA links when `STRIMZ_DASHBOARD_URL` isn't set. */
export const STRIMZ_ORIGIN = 'https://strimz.finance'
