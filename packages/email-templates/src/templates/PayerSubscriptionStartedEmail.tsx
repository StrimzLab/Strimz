import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PayerSubscriptionStartedEmailProps {
  merchantBusinessName: string
  planName: string
  amountDisplay: string
  intervalDisplay: string
  nextChargeDisplay: string
  subscriptionId: string
  startedAtDisplay: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  explorerTxUrl: string
}

/**
 * Sent to the payer the first time a subscription enrols. Confirms
 * recurring terms so they know exactly what to expect: how much, how
 * often, and what to reference if they need to cancel through the
 * merchant.
 */
export function PayerSubscriptionStartedEmail({
  merchantBusinessName,
  planName,
  amountDisplay,
  intervalDisplay,
  nextChargeDisplay,
  subscriptionId,
  startedAtDisplay,
  network,
  explorerTxUrl,
}: PayerSubscriptionStartedEmailProps) {
  return (
    <Shell
      preview={`Your ${planName} subscription to ${merchantBusinessName} is active`}
      title={`You subscribed to ${merchantBusinessName}`}
      subtitle="Subscription active"
      tone="success"
    >
      <Text style={leadStyle}>
        Your subscription to <strong>{merchantBusinessName}</strong> is now active. You will be
        charged <strong>{amountDisplay}</strong> {intervalDisplay} from your connected wallet.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Merchant" value={merchantBusinessName} />
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount" value={`${amountDisplay} ${intervalDisplay}`} />
        <DetailRow label="Started" value={startedAtDisplay} />
        <DetailRow label="Next charge" value={nextChargeDisplay} />
        <DetailRow label="Subscription ID" value={subscriptionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={explorerTxUrl} style={primaryButtonStyle}>
          View enrolment on Arcscan
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        To cancel, update, or ask about this subscription, contact {merchantBusinessName} directly.
        Cancelling in your wallet stops future charges immediately.
      </Text>
      <Text style={secondaryLinkRowStyle}>
        Receipt delivered by Strimz on behalf of the merchant. Learn more at{' '}
        <Link href="https://strimz.finance" style={{ color: colors.link, fontFamily: fonts.body }}>
          strimz.finance
        </Link>
        .
      </Text>
    </Shell>
  )
}

PayerSubscriptionStartedEmail.PreviewProps = {
  merchantBusinessName: 'Fanline',
  planName: 'Creator Pro',
  amountDisplay: '10.00 USDC',
  intervalDisplay: 'every month',
  nextChargeDisplay: 'August 9, 2026',
  subscriptionId: 'sub_cmr9m3hg20004jy6lprky8ao7',
  startedAtDisplay: 'July 9, 2026',
  network: 'Arc Testnet',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
} as PayerSubscriptionStartedEmailProps

export default PayerSubscriptionStartedEmail

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
