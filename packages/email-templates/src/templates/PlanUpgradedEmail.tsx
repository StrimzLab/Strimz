import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_ORIGIN, colors, fonts, radii } from '../theme.js'

interface PlanUpgradedEmailProps {
  merchantBusinessName: string | null
  planName: string
  feeDisplay: string
  thresholdDisplay: string
  unlockedFeatures: string[]
  explorerTxUrl: string | null
  dashboardUrl: string
}

export function PlanUpgradedEmail({
  merchantBusinessName,
  planName,
  feeDisplay,
  thresholdDisplay,
  unlockedFeatures,
  explorerTxUrl,
  dashboardUrl,
}: PlanUpgradedEmailProps) {
  return (
    <Shell
      preview={`You've moved to ${planName}: ${feeDisplay} per transaction`}
      title={`You've moved to ${planName}`}
      subtitle="Plan upgraded"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {merchantBusinessName ?? 'there'}, you have processed {thresholdDisplay}, so your account
        moved to {planName}. From your next payment, Strimz takes {feeDisplay} per transaction.
        Plans only move up, so you stay on {planName} from now on.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Fee" value={`${feeDisplay} per transaction`} />
        {unlockedFeatures.map((feature) => (
          <DetailRow key={feature} label="Unlocked" value={feature} />
        ))}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          Open dashboard
        </Button>
      </Section>

      {explorerTxUrl ? (
        <Text style={secondaryLinkRowStyle}>
          Fee change:{' '}
          <Link href={explorerTxUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
            view on Arcscan
          </Link>
        </Text>
      ) : null}
    </Shell>
  )
}

PlanUpgradedEmail.PreviewProps = {
  merchantBusinessName: 'Smoke Test Co',
  planName: 'Starter',
  feeDisplay: '0.5%',
  thresholdDisplay: '1,000 USDC',
  unlockedFeatures: ['Storefront builder', 'Anomaly alerts', 'Yield recommendations'],
  explorerTxUrl: `https://explorer.testnet.arc.io/tx/0x${'4d'.repeat(32)}`,
  dashboardUrl: `${STRIMZ_ORIGIN}/app/settings`,
} as PlanUpgradedEmailProps

export default PlanUpgradedEmail

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
  margin: '8px 0 0',
}
