import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_BRAND_URL, colors, fonts, radii } from '../theme.js'

type AdminUserStatus = 'active' | 'suspended'

interface AdminStatusChangedEmailProps {
  /** Display name; falls back to "there". */
  adminName: string | null
  newStatus: AdminUserStatus
  actorDisplay: string
  actorEmail: string
  dashboardUrl: string
}

/**
 * Sent when a super_admin suspends or reactivates another admin.
 *
 * One template, two states. The tone, subject, and body flip based on
 * `newStatus` — suspended is a danger pill ("your access is paused
 * pending review"), reactivated is a success pill ("welcome back").
 * The DELETE-admin path on the controller is an alias for `suspended`,
 * so it fires this email too with the suspended branch.
 */
export function AdminStatusChangedEmail({
  adminName,
  newStatus,
  actorDisplay,
  actorEmail,
  dashboardUrl,
}: AdminStatusChangedEmailProps) {
  const greeting = adminName ?? 'there'
  const isSuspended = newStatus === 'suspended'

  return (
    <Shell
      preview={
        isSuspended
          ? 'Your Strimz admin access has been paused'
          : 'Your Strimz admin access has been restored'
      }
      title={
        isSuspended ? `Your admin access is paused, ${greeting}.` : `Welcome back, ${greeting}.`
      }
      subtitle={isSuspended ? 'Access suspended' : 'Access restored'}
      tone={isSuspended ? 'danger' : 'success'}
    >
      <Text style={leadStyle}>
        {isSuspended ? (
          <>
            Hi {greeting}, {actorDisplay} ({actorEmail}) suspended your Strimz admin access. You’ll
            be signed out of the admin dashboard and any further requests to{' '}
            <code style={codeInlineStyle}>/v1/admin/*</code> will be refused.
          </>
        ) : (
          <>
            Hi {greeting}, {actorDisplay} ({actorEmail}) reactivated your Strimz admin access.
            Everything you had before is back; sign in to pick up where you left off.
          </>
        )}
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Status" value={isSuspended ? 'Suspended' : 'Active'} />
        <DetailRow label="Changed by" value={actorDisplay} />
      </Section>

      <Text style={blurbStyle}>
        {isSuspended
          ? 'If this is a mistake, reply to this email and we’ll look into it. The audit log records every admin action, including this one.'
          : 'Your role and permissions are unchanged from before the pause. Click below to head back in.'}
      </Text>

      {!isSuspended ? (
        <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
          <Button href={dashboardUrl} style={primaryButtonStyle}>
            Open admin dashboard
          </Button>
        </Section>
      ) : null}

      <Text style={tipStyle}>
        {isSuspended
          ? 'Reply to this email to reach the team. We don’t suspend access without a reason — let us walk you through it.'
          : 'If you’re seeing access errors after signing in, hard-refresh — your browser may be caching the suspended response.'}
      </Text>
    </Shell>
  )
}

AdminStatusChangedEmail.PreviewProps = {
  adminName: 'Alice',
  newStatus: 'suspended',
  actorDisplay: 'Emmanuel',
  actorEmail: 'emmanuelomemgboji@gmail.com',
  dashboardUrl: `${STRIMZ_BRAND_URL}/admin`,
} as AdminStatusChangedEmailProps

export default AdminStatusChangedEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 24px',
}

const codeInlineStyle: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 13,
  background: colors.detailBg,
  padding: '1px 5px',
  borderRadius: 4,
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
