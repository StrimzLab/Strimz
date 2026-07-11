import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PayerPaymentReceiptEmailProps {
  merchantBusinessName: string
  amountDisplay: string
  sessionDescription: string | null
  sessionId: string
  paidAtDisplay: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  explorerTxUrl: string
}

/**
 * Sent to the payer once a one-off hosted-checkout payment confirms
 * on-chain. Strimz is the sender, the body foregrounds the merchant
 * the payer actually transacted with. Include an on-chain link so a
 * skeptical payer can verify the receipt themselves.
 */
export function PayerPaymentReceiptEmail({
  merchantBusinessName,
  amountDisplay,
  sessionDescription,
  sessionId,
  paidAtDisplay,
  network,
  explorerTxUrl,
}: PayerPaymentReceiptEmailProps) {
  return (
    <Shell
      preview={`Your ${amountDisplay} payment to ${merchantBusinessName} is confirmed`}
      title={`Thanks for your payment`}
      subtitle="Payment confirmed"
      tone="success"
    >
      <Text style={leadStyle}>
        Your payment of <strong>{amountDisplay}</strong> to <strong>{merchantBusinessName}</strong>{' '}
        has settled on-chain. Keep this email as your receipt.
      </Text>

      <Section style={detailBoxStyle}>
        {sessionDescription && <DetailRow label="Item" value={sessionDescription} />}
        <DetailRow label="Merchant" value={merchantBusinessName} />
        <DetailRow label="Amount" value={amountDisplay} />
        <DetailRow label="Paid" value={paidAtDisplay} />
        <DetailRow label="Reference" value={sessionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={explorerTxUrl} style={primaryButtonStyle}>
          View on Arcscan
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        Questions about the item you paid for? Reach out to {merchantBusinessName} directly.
      </Text>
      <Text style={secondaryLinkRowStyle}>
        This receipt was sent by Strimz, the payment gateway {merchantBusinessName} uses. Learn more
        at{' '}
        <Link href="https://strimz.io" style={{ color: colors.link, fontFamily: fonts.body }}>
          strimz.io
        </Link>
        .
      </Text>
    </Shell>
  )
}

PayerPaymentReceiptEmail.PreviewProps = {
  merchantBusinessName: 'Fanline',
  amountDisplay: '5.00 USDC',
  sessionDescription: 'Pro Card - one-time',
  sessionId: 'cmr8m3hg20004jy6lprky8ao7',
  paidAtDisplay: 'July 9, 2026 at 8:04 AM UTC',
  network: 'Arc Testnet',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
} as PayerPaymentReceiptEmailProps

export default PayerPaymentReceiptEmail

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
