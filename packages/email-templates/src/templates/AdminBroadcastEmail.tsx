import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'

import { Shell } from '../components/Shell.js'
import { STRIMZ_BRAND_URL, colors, fonts, radii } from '../theme.js'

interface AdminBroadcastEmailProps {
  /** Merchant recipient — pulled from the DB, may be null in tests. */
  recipientName: string | null
  /** Broadcast subject; used as the email subject too. */
  title: string
  /** Broadcast body. Rendered verbatim; whitespace preserved. */
  body: string
  /** Human display for the sender (name, else email). */
  senderDisplay: string
  /** Sender's email, shown as a "reply-to" hint. */
  senderEmail: string
  /** Where to send the recipient to see the message in full. */
  dashboardUrl: string
  /** `all` shows a "sent to every merchant" note; `merchant` doesn't. */
  audience: 'all' | 'merchant'
}

/**
 * Email delivery for an admin-triggered broadcast. Sent to every
 * affected merchant when `AdminService.createBroadcast` fans out.
 *
 * The broadcast content is treated as short-form transactional copy:
 * a paragraph of context plus a CTA that deep-links back to the
 * dashboard notification tray. We deliberately do NOT render an HTML
 * body from a rich source — brands who want rich formatting should
 * build a follow-up template. This is the "hey, something we need to
 * tell you" pattern.
 */
export function AdminBroadcastEmail({
  recipientName,
  title,
  body,
  senderDisplay,
  senderEmail,
  dashboardUrl,
  audience,
}: AdminBroadcastEmailProps) {
  const preview = body.length > 90 ? `${body.slice(0, 87)}...` : body
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'

  return (
    <Shell preview={preview} title={title} subtitle="Message from Strimz">
      <Section style={{ marginTop: 12 }}>
        <Text style={pStyle}>{greeting}</Text>
        <Text style={pStyle}>
          {audience === 'all'
            ? "We're reaching out to every Strimz merchant with an update."
            : `${senderDisplay} sent you a message from the Strimz operator dashboard.`}
        </Text>
      </Section>

      {/* The admin composer produces sanitised TipTap HTML (paragraphs,
         bold, italic, lists, links). Emailing it verbatim preserves the
         formatting operators wrote; React Email + Tailwind-safe inline
         styles don't cover this so we drop into a hand-styled block. */}
      <Section
        style={panelStyle}
        dangerouslySetInnerHTML={{ __html: sanitiseBroadcastHtml(body) }}
      />

      <Section style={{ marginTop: 20, textAlign: 'center' }}>
        <Button href={dashboardUrl} style={buttonStyle}>
          Open dashboard
        </Button>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text style={muted}>
          Sent by {senderDisplay} ({senderEmail}) via Strimz.{' '}
          <a href={STRIMZ_BRAND_URL} style={{ color: colors.link }}>
            strimz.finance
          </a>
        </Text>
      </Section>
    </Shell>
  )
}

const pStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 15,
  lineHeight: 1.55,
  color: colors.foreground,
  margin: '0 0 12px',
}

const panelStyle: React.CSSProperties = {
  backgroundColor: colors.detailBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radii.detail,
  padding: '16px 18px',
  marginTop: 8,
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: '#ffffff',
  fontFamily: fonts.body,
  fontSize: 14,
  fontWeight: 600,
  padding: '12px 24px',
  borderRadius: radii.detail,
  textDecoration: 'none',
  display: 'inline-block',
}

const muted: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 12,
  lineHeight: 1.55,
  color: colors.muted,
}

/**
 * Cheap allow-list sanitiser for the broadcast HTML we receive from
 * the admin composer. The composer only emits a fixed set of tags
 * (paragraphs, bold, italic, ordered / unordered lists, headings, and
 * links). This is a belt-and-braces strip of anything else that might
 * slip through — script tags, iframe, style, on* handlers — so the
 * email never renders anything unexpected. We DON'T aim for OWASP-
 * grade sanitisation because the input is admin-authored, not user-
 * authored; this is defensive rather than security-critical.
 */
function sanitiseBroadcastHtml(html: string): string {
  // Strip any script / iframe / style / object / embed blocks and any
  // inline `on*` event-handler attributes. Uses per-tag alternates so
  // we avoid backreferences (tsup's dts pass doesn't like them).
  const dangerousTagRe =
    /<\s*(script|iframe|style|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*(?:script|iframe|style|object|embed)\s*>/gi
  return html
    .replace(dangerousTagRe, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}
