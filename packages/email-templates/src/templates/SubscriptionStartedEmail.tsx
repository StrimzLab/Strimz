import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_ORIGIN, colors, fonts, radii } from '../theme.js'

interface SubscriptionStartedEmailProps {
  merchantBusinessName: string
  planName: string
  amountDisplay: string
  cadenceDisplay: string
  payerAddressShort: string
  subscriptionId: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  nextChargeAt: string
  explorerTxUrl: string
  dashboardUrl: string
}

/**
 * Sent to the merchant when a payer completes the permit + enrol flow
 * and the indexer projects a new `Subscription` row.
 *
 * Two facts the merchant scans for: "who signed up" and "when's the
 * first recurring charge". Everything else lives behind the CTA.
 */
export function SubscriptionStartedEmail({
  merchantBusinessName,
  planName,
  amountDisplay,
  cadenceDisplay,
  payerAddressShort,
  subscriptionId,
  network,
  nextChargeAt,
  explorerTxUrl,
  dashboardUrl,
}: SubscriptionStartedEmailProps) {
  return (
    <Shell
      preview={`${payerAddressShort} just subscribed to ${planName}`}
      title={`New subscriber on ${planName}`}
      subtitle="Subscription started"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {merchantBusinessName ?? 'there'}, a new payer just enrolled. We'll charge them{' '}
        {amountDisplay} {cadenceDisplay} automatically — no further action needed from you.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount" value={`${amountDisplay} / ${cadenceDisplay}`} />
        <DetailRow label="Payer" value={payerAddressShort} mono />
        <DetailRow label="Next charge" value={nextChargeAt} />
        <DetailRow label="Subscription" value={subscriptionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          View subscriber
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        Enrolment tx:{' '}
        <Link href={explorerTxUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
          view on Arcscan
        </Link>
      </Text>
    </Shell>
  )
}

SubscriptionStartedEmail.PreviewProps = {
  merchantBusinessName: 'Smoke Test Co',
  planName: 'Pro — Monthly',
  amountDisplay: '9.99 USDC',
  cadenceDisplay: 'every 30 days',
  payerAddressShort: '0xFd02…7150',
  subscriptionId: 'cmq4wck6a0002je6lfmb5bgjp',
  network: 'Arc Testnet',
  nextChargeAt: 'Jul 8, 2026',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
  dashboardUrl: `${STRIMZ_ORIGIN}/app/subscriptions`,
} as SubscriptionStartedEmailProps

export default SubscriptionStartedEmail

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
