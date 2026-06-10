import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_ORIGIN, colors, fonts, radii } from '../theme.js'

interface SubscriptionChargedEmailProps {
  merchantBusinessName: string
  planName: string
  amountDisplay: string
  payerAddressShort: string
  subscriptionId: string
  chargeId: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  periodLabel: string // e.g. "Jun 8 – Jul 8, 2026"
  nextChargeAt: string | null // null when the subscription just ended
  explorerTxUrl: string
  dashboardUrl: string
}

/**
 * Sent to the merchant when a recurring charge succeeds on-chain.
 *
 * Lean by design — the merchant gets one of these per active subscriber
 * per period. Volume scales, so this email has to read fast: amount,
 * who, when's the next one. Detail belongs on the dashboard.
 */
export function SubscriptionChargedEmail({
  merchantBusinessName,
  planName,
  amountDisplay,
  payerAddressShort,
  subscriptionId,
  chargeId,
  network,
  periodLabel,
  nextChargeAt,
  explorerTxUrl,
  dashboardUrl,
}: SubscriptionChargedEmailProps) {
  return (
    <Shell
      preview={`${amountDisplay} charged for ${planName}`}
      title={`You received ${amountDisplay}`}
      subtitle="Recurring charge succeeded"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {merchantBusinessName ?? 'there'}, a recurring charge on{' '}
        <strong style={strong}>{planName}</strong> just settled. Funds are in your payout wallet —
        Strimz already deducted the fee.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount" value={amountDisplay} />
        <DetailRow label="Payer" value={payerAddressShort} mono />
        <DetailRow label="Period" value={periodLabel} />
        <DetailRow label="Next charge" value={nextChargeAt ?? 'Subscription ended'} />
        <DetailRow label="Subscription" value={subscriptionId} mono />
        <DetailRow label="Charge" value={chargeId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          View charge
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        On-chain tx:{' '}
        <Link href={explorerTxUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
          view on Arcscan
        </Link>
      </Text>
    </Shell>
  )
}

SubscriptionChargedEmail.PreviewProps = {
  merchantBusinessName: 'Smoke Test Co',
  planName: 'Pro — Monthly',
  amountDisplay: '9.99 USDC',
  payerAddressShort: '0xFd02…7150',
  subscriptionId: 'cmq4wck6a0002je6lfmb5bgjp',
  chargeId: 'ch_01HY9TM1R2R6S8VFA9X7B5GZ2N',
  network: 'Arc Testnet',
  periodLabel: 'Jun 8 – Jul 8, 2026',
  nextChargeAt: 'Jul 8, 2026',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
  dashboardUrl: `${STRIMZ_ORIGIN}/app/subscriptions`,
} as SubscriptionChargedEmailProps

export default SubscriptionChargedEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 24px',
}

const strong: React.CSSProperties = {
  color: colors.foreground,
  fontWeight: 600,
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
