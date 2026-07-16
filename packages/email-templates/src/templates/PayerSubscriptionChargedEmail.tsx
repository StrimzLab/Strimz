import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PayerSubscriptionChargedEmailProps {
  merchantBusinessName: string
  planName: string
  amountDisplay: string
  chargedAtDisplay: string
  nextChargeDisplay: string | null
  subscriptionId: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  explorerTxUrl: string
}

/**
 * Sent to the payer each time their subscription renews on-chain.
 * Kept short so a monthly recurrent charge does not feel spammy: the
 * amount, the merchant, and a link to prove it. Nothing else.
 */
export function PayerSubscriptionChargedEmail({
  merchantBusinessName,
  planName,
  amountDisplay,
  chargedAtDisplay,
  nextChargeDisplay,
  subscriptionId,
  network,
  explorerTxUrl,
}: PayerSubscriptionChargedEmailProps) {
  return (
    <Shell
      preview={`${merchantBusinessName} charged ${amountDisplay} for ${planName}`}
      title={`You were charged ${amountDisplay}`}
      subtitle="Subscription renewed"
      tone="success"
    >
      <Text style={leadStyle}>
        <strong>{merchantBusinessName}</strong> renewed your <strong>{planName}</strong>{' '}
        subscription. The charge cleared on-chain from your connected wallet.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Merchant" value={merchantBusinessName} />
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Amount" value={amountDisplay} />
        <DetailRow label="Charged" value={chargedAtDisplay} />
        {nextChargeDisplay && <DetailRow label="Next charge" value={nextChargeDisplay} />}
        <DetailRow label="Subscription ID" value={subscriptionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={explorerTxUrl} style={primaryButtonStyle}>
          View charge on Arcscan
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        To cancel this subscription contact {merchantBusinessName}. You can also stop future charges
        yourself by revoking token approval in your wallet.
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

PayerSubscriptionChargedEmail.PreviewProps = {
  merchantBusinessName: 'Fanline',
  planName: 'Creator Pro',
  amountDisplay: '10.00 USDC',
  chargedAtDisplay: 'August 9, 2026 at 8:04 AM UTC',
  nextChargeDisplay: 'September 9, 2026',
  subscriptionId: 'sub_cmr9m3hg20004jy6lprky8ao7',
  network: 'Arc Testnet',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
} as PayerSubscriptionChargedEmailProps

export default PayerSubscriptionChargedEmail

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
