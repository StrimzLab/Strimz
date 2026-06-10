import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_BRAND_URL, colors, fonts, radii } from '../theme.js'

type AdminRole = 'super_admin' | 'admin' | 'read_only'

interface AdminRoleChangedEmailProps {
  /** Display name; falls back to "there". */
  adminName: string | null
  previousRole: AdminRole
  newRole: AdminRole
  actorDisplay: string
  actorEmail: string
  dashboardUrl: string
}

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  read_only: 'Read-only admin',
}

const ROLE_BLURB: Record<AdminRole, string> = {
  super_admin:
    'You can do everything — manage merchants, change tiers, invite or remove other admins, see every metric.',
  admin:
    'You can manage merchants and platform settings, but not other admin users. Analytics + write actions are yours.',
  read_only:
    'You can see everything — merchants, analytics, operational health — but you can’t make changes.',
}

/**
 * Sent when a super_admin changes another admin's role.
 *
 * The change has already taken effect on chain (well, in the DB) by
 * the time this email lands — the affected admin's next request to
 * `/v1/admin/*` will be gated against the new role. The email exists
 * to surface the change so they're not surprised when previously
 * working buttons start returning `403 admin_insufficient_role`.
 */
export function AdminRoleChangedEmail({
  adminName,
  previousRole,
  newRole,
  actorDisplay,
  actorEmail,
  dashboardUrl,
}: AdminRoleChangedEmailProps) {
  const greeting = adminName ?? 'there'
  return (
    <Shell
      preview={`Your Strimz role was changed to ${ROLE_LABEL[newRole]}`}
      title={`Your admin role was updated, ${greeting}.`}
      subtitle="Role change"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {greeting}, {actorDisplay} ({actorEmail}) just changed your Strimz admin role. The change
        is effective immediately.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Previous role" value={ROLE_LABEL[previousRole]} />
        <DetailRow label="New role" value={ROLE_LABEL[newRole]} />
        <DetailRow label="Changed by" value={actorDisplay} />
      </Section>

      <Text style={blurbStyle}>{ROLE_BLURB[newRole]}</Text>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          Open admin dashboard
        </Button>
      </Section>

      <Text style={tipStyle}>
        If this change wasn’t expected, reply to this email and we’ll loop the team in. Every admin
        action is in the audit log.
      </Text>
    </Shell>
  )
}

AdminRoleChangedEmail.PreviewProps = {
  adminName: 'Alice',
  previousRole: 'admin',
  newRole: 'super_admin',
  actorDisplay: 'Emmanuel',
  actorEmail: 'emmanuelomemgboji@gmail.com',
  dashboardUrl: `${STRIMZ_BRAND_URL}/admin`,
} as AdminRoleChangedEmailProps

export default AdminRoleChangedEmail

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
