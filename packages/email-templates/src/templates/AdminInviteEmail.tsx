import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_BRAND_URL, colors, fonts, radii } from '../theme.js'

interface AdminInviteEmailProps {
  /** Display name the invite addresses. Falls back to "there". */
  inviteeName: string | null
  /** Role they were granted. Renders as "super admin", "admin", or "read only". */
  role: 'super_admin' | 'admin' | 'read_only'
  /** Inviter's name (or email if name is null) — shown in the body. */
  inviterDisplay: string
  /** Inviter's email — shown as a secondary identifier. */
  inviterEmail: string
  /** Where to send them. Defaults to the dashboard root. */
  dashboardUrl: string
}

const ROLE_LABEL: Record<AdminInviteEmailProps['role'], string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  read_only: 'Read-only admin',
}

const ROLE_BLURB: Record<AdminInviteEmailProps['role'], string> = {
  super_admin:
    'You can do everything — manage merchants, change tiers, invite or remove other admins, see every metric.',
  admin:
    'You can manage merchants and platform settings, but not other admin users. Analytics + write actions are all yours.',
  read_only:
    'You can see everything — merchants, analytics, operational health — but you can’t make changes.',
}

/**
 * Sent when a super_admin invites a new admin user via `inviteAdmin`.
 *
 * The invitee follows a "claim on first login" flow: their `AdminUser`
 * row exists from the moment we send this email, but `privyUserId` is
 * NULL until they sign in with the matching email. The dashboard URL
 * lands them on the admin login; `AdminAuthGuard` claims their row the
 * first time they authenticate.
 */
export function AdminInviteEmail({
  inviteeName,
  role,
  inviterDisplay,
  inviterEmail,
  dashboardUrl,
}: AdminInviteEmailProps) {
  const greeting = inviteeName ?? 'there'
  return (
    <Shell
      preview={`${inviterDisplay} added you as a Strimz admin`}
      title={`You’re a Strimz admin, ${greeting}.`}
      subtitle="Admin access granted"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {greeting}, {inviterDisplay} ({inviterEmail}) added you as a Strimz operator. Your access
        is ready as soon as you sign in.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Role" value={ROLE_LABEL[role]} />
        <DetailRow label="Invited by" value={inviterDisplay} />
        <DetailRow label="Sign in with" value="The email this message was sent to" mono />
      </Section>

      <Text style={blurbStyle}>{ROLE_BLURB[role]}</Text>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          Open admin dashboard
        </Button>
      </Section>

      <Text style={tipStyle}>
        Sign in with this same email through Privy on the dashboard. Your admin profile is created
        automatically the first time you authenticate — no separate signup, no password to remember.
      </Text>
    </Shell>
  )
}

AdminInviteEmail.PreviewProps = {
  inviteeName: 'Alice',
  role: 'admin',
  inviterDisplay: 'Emmanuel',
  inviterEmail: 'emmanuelomemgboji@gmail.com',
  dashboardUrl: `${STRIMZ_BRAND_URL}/admin`,
} as AdminInviteEmailProps

export default AdminInviteEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 24px',
}

const detailBoxStyle: React.CSSProperties = {
  background: colors.detailBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radii.detail,
  padding: '4px 16px',
  margin: '8px 0',
}

const blurbStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '16px 0 0',
}

const primaryButtonStyle: React.CSSProperties = {
  background: colors.primary,
  color: '#FFFFFF',
  fontFamily: fonts.body,
  fontWeight: 500,
  fontSize: 14,
  padding: '10px 20px',
  borderRadius: 8,
  textDecoration: 'none',
  display: 'inline-block',
}

const tipStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: colors.subtle,
  margin: '20px 0 0',
}
