import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'

import { Shell } from '../components/Shell.js'
import { STRIMZ_BRAND_URL, colors, fonts, radii } from '../theme.js'

interface AdminBroadcastEmailProps {
  /** Merchant recipient — pulled from the DB, may be null in tests. */
  recipientName: string | null
  /** Broadcast subject; used as the email subject too. */
  title: string
  /** Broadcast body as HTML, already sanitized by the caller. */
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

/** Sent to every affected merchant when `AdminService.createBroadcast` fans out. */
export function AdminBroadcastEmail({
  recipientName,
  title,
  body,
  senderDisplay,
  senderEmail,
  dashboardUrl,
  audience,
}: AdminBroadcastEmailProps) {
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const preview = text.length > 90 ? `${text.slice(0, 87)}...` : text
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

      <Section style={panelStyle}>
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </Section>

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
