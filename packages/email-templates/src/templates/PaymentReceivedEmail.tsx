import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PaymentReceivedEmailProps {
  merchantBusinessName: string
  amountDisplay: string // already formatted, e.g. "1.50 USDC"
  payerAddressShort: string // e.g. "0xFd02…7150"
  sessionDescription: string | null
  sessionId: string
  network: 'Arc Testnet' | 'Arc Mainnet'
  explorerTxUrl: string
  dashboardUrl: string
}

/**
 * Sent to the merchant when a hosted-checkout payment confirms.
 *
 * Body intentionally lean: the merchant scans the inbox, sees the
 * amount, the description, and that the payer cleared on-chain. Deep
 * detail (full tx hash, gas paid, indexer state) belongs on the
 * dashboard transaction page the CTA links to.
 */
export function PaymentReceivedEmail({
  merchantBusinessName,
  amountDisplay,
  payerAddressShort,
  sessionDescription,
  sessionId,
  network,
  explorerTxUrl,
  dashboardUrl,
}: PaymentReceivedEmailProps) {
  return (
    <Shell
      preview={`${amountDisplay} settled to your payout address`}
      title={`You received ${amountDisplay}`}
      subtitle="Payment confirmed"
      tone="success"
    >
      <Text style={leadStyle}>
        Hi {merchantBusinessName ?? 'there'}, a new payment just settled on-chain. The funds are in
        your payout wallet now — Strimz already deducted the fee.
      </Text>

      <Section style={detailBoxStyle}>
        {sessionDescription && <DetailRow label="Item" value={sessionDescription} />}
        <DetailRow label="Amount" value={amountDisplay} />
        <DetailRow label="From payer" value={payerAddressShort} mono />
        <DetailRow label="Session" value={sessionId} mono />
        <DetailRow label="Network" value={network} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={dashboardUrl} style={primaryButtonStyle}>
          View in dashboard
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        Or open the on-chain transaction:{' '}
        <Link href={explorerTxUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
          view on Arcscan
        </Link>
      </Text>
    </Shell>
  )
}

PaymentReceivedEmail.PreviewProps = {
  merchantBusinessName: 'Smoke Test Co',
  amountDisplay: '1.50 USDC',
  payerAddressShort: '0xFd02…7150',
  sessionDescription: 'Pro Plan — monthly',
  sessionId: 'cmq4wck6a0002je6lfmb5bgjp',
  network: 'Arc Testnet',
  explorerTxUrl:
    'https://testnet.arcscan.app/tx/0x4d328b9b2590614e51c9401a06b3b643e401965972a2494ce593edf71b251907',
  dashboardUrl: 'https://strimz-finance.vercel.app/app/transactions',
} as PaymentReceivedEmailProps

export default PaymentReceivedEmail

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
