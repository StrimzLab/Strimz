import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PayerRefundReceiptEmailProps {
  merchantBusinessName: string
  refundAmountDisplay: string
  originalAmountDisplay: string
  originalPaidAtDisplay: string
  refundedAtDisplay: string
  reason: string | null
  refundId: string
  sessionId: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  explorerTxUrl: string
}

/**
 * Sent to the payer when a merchant issues a refund on a past
 * payment. Whether partial or full, the payer needs to know what
 * came back and against which original charge.
 */
export function PayerRefundReceiptEmail({
  merchantBusinessName,
  refundAmountDisplay,
  originalAmountDisplay,
  originalPaidAtDisplay,
  refundedAtDisplay,
  reason,
  refundId,
  sessionId,
  network,
  explorerTxUrl,
}: PayerRefundReceiptEmailProps) {
  return (
    <Shell
      preview={`${merchantBusinessName} refunded ${refundAmountDisplay}`}
      title={`You were refunded ${refundAmountDisplay}`}
      subtitle="Refund issued"
      tone="success"
    >
      <Text style={leadStyle}>
        <strong>{merchantBusinessName}</strong> issued a refund of{' '}
        <strong>{refundAmountDisplay}</strong> against your original payment of{' '}
        {originalAmountDisplay}. The refund is on-chain in your wallet.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Merchant" value={merchantBusinessName} />
        <DetailRow label="Refund amount" value={refundAmountDisplay} />
        <DetailRow label="Original amount" value={originalAmountDisplay} />
        <DetailRow label="Originally paid" value={originalPaidAtDisplay} />
        <DetailRow label="Refunded" value={refundedAtDisplay} />
        {reason && <DetailRow label="Reason" value={reason} />}
        <DetailRow label="Refund ID" value={refundId} mono />
        <DetailRow label="Original session" value={sessionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={explorerTxUrl} style={primaryButtonStyle}>
          View refund on Arcscan
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        Questions about this refund? Contact {merchantBusinessName} directly.
      </Text>
      <Text style={secondaryLinkRowStyle}>
        Receipt delivered by Strimz on behalf of the merchant. Learn more at{' '}
        <Link href="https://strimz.io" style={{ color: colors.link, fontFamily: fonts.body }}>
          strimz.io
        </Link>
        .
      </Text>
    </Shell>
  )
}

PayerRefundReceiptEmail.PreviewProps = {
  merchantBusinessName: 'Fanline',
  refundAmountDisplay: '5.00 USDC',
  originalAmountDisplay: '5.00 USDC',
  originalPaidAtDisplay: 'July 9, 2026',
  refundedAtDisplay: 'July 12, 2026 at 3:14 PM UTC',
  reason: 'Customer request',
  refundId: 're_cmrbrefund1234',
  sessionId: 'cmr8m3hg20004jy6lprky8ao7',
  network: 'Arc Testnet',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
} as PayerRefundReceiptEmailProps

export default PayerRefundReceiptEmail

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
