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

/**
 * Absolute logo URL. Hosted by the marketing site so the email image
 * stays in sync with the brand without a separate asset pipeline.
 *
 * Pointed at `blueLogo.png` because the Shell renders on a light
 * card — the dark logo reads cleanly. When a dedicated `emailLogo.png`
 * (wider with extra padding) ships in `apps/web/public/logo/`, swap
 * this constant.
 *
 * NOTE: emails are static at send time — if the marketing host moves,
 * old emails will show a broken image. Cheap to fix (logo lives at a
 * known path) but worth knowing.
 */
export const LOGO_URL = 'https://strimz-finance.vercel.app/logo/blueLogo.png'

/** Where reply-to / contact links go. The Strimz operations mailbox. */
export const SUPPORT_EMAIL = 'strimztokenstream@gmail.com'

/**
 * The brand-facing URL shown in email footers and signature lines.
 *
 * Distinct from {@link STRIMZ_ORIGIN}: BRAND_URL represents Strimz to
 * the recipient — it reads `strimz.finance` even before the apex is
 * pointed at Vercel, so emails don't telegraph "this is a free-tier
 * preview deploy" to merchants. `STRIMZ_ORIGIN` is the *operational*
 * URL we actually navigate users to (Vercel preview today, the apex
 * once it's plugged in).
 *
 * When the custom domain is wired, BRAND_URL and STRIMZ_ORIGIN
 * collapse into the same value — but until then, keeping them split
 * lets brand display read cleanly without breaking real CTAs.
 */
export const STRIMZ_BRAND_URL = 'https://strimz.finance'

/** Human-readable brand-display host (no scheme), e.g. for footer text. */
export const STRIMZ_BRAND_DISPLAY = 'strimz.finance'

/**
 * Canonical *operational* origin — used as the fallback for CTA links
 * when no per-env override (`STRIMZ_DASHBOARD_URL`) is set. Currently
 * the Vercel preview because the apex isn't live yet. Update once
 * `strimz.finance` is pointed at the deployment.
 */
export const STRIMZ_ORIGIN = 'https://strimz-finance.vercel.app'
