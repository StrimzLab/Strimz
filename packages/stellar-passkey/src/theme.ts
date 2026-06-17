/**
 * Strimz brand theme tokens for the passkey flow UI.
 *
 * Maps to CSS custom properties on `<PasskeyFlow>` — the consumer
 * styles `.pk-*` classes against these vars, or just relies on the
 * inline defaults. Matches the Strimz brand palette (green primary on
 * neutral foreground; warm advisory; warning red) so the enrolment
 * flow doesn't look like a third-party drop-in.
 */

export const STRIMZ_PASSKEY_THEME = {
  foreground: '#050020',
  muted: '#58556A',
  accent: '#02C76A',
  accentForeground: '#FFFFFF',
  advisory: '#D9A05B',
  blocker: '#D4766A',
  radius: '12px',
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const
