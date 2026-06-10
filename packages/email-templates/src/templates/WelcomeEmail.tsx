import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { Shell } from '../components/Shell.js'
import { STRIMZ_ORIGIN, colors, fonts } from '../theme.js'

interface WelcomeEmailProps {
  merchantBusinessName: string | null
  dashboardUrl: string
  docsUrl: string
}

/**
 * Sent once, the first time a merchant authenticates and the API syncs
 * their Privy identity into the Merchant table. Intentionally short:
 * the goal is to get them to the dashboard, not to teach product.
 */
export function WelcomeEmail({ merchantBusinessName, dashboardUrl, docsUrl }: WelcomeEmailProps) {
  const greeting = merchantBusinessName ?? 'there'

  return (
    <Shell
      preview="Welcome to Strimz — your stablecoin payments dashboard is ready"
      title={`Welcome, ${greeting}.`}
      subtitle="Account created"
      tone="success"
    >
      <Text style={leadStyle}>
        Your Strimz workspace is live. Accept USDC on Arc with hosted checkout, subscriptions, and
        webhooks — no gas-paying-payer hand-holding, no chain switching, no surprise fees.
      </Text>

      <Text style={leadStyle}>Three things worth doing next:</Text>

      <Text style={listItemStyle}>
        <strong style={strong}>1.</strong> Create your first payment link from the dashboard.
      </Text>
      <Text style={listItemStyle}>
        <strong style={strong}>2.</strong> Point a webhook at your backend so confirmed payments
        reach your own ledger in real time.
      </Text>
      <Text style={listItemStyle}>
        <strong style={strong}>3.</strong> Skim the integration docs — they're short.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          Open dashboard
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        Docs:{' '}
        <Link href={docsUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
          read the integration guide
        </Link>
      </Text>
    </Shell>
  )
}

WelcomeEmail.PreviewProps = {
  merchantBusinessName: 'Smoke Test Co',
  dashboardUrl: `${STRIMZ_ORIGIN}/app`,
  docsUrl: `${STRIMZ_ORIGIN}/docs`,
} as WelcomeEmailProps

export default WelcomeEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 16px',
}

const listItemStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 6px',
}

const strong: React.CSSProperties = {
  color: colors.foreground,
  fontWeight: 600,
  marginRight: 6,
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

const secondaryLinkRowStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: colors.muted,
  margin: '12px 0 0',
}
