import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

interface PayerAllowanceRenewalEmailProps {
  merchantBusinessName: string
  planName: string
  amountDisplay: string
  renewUrl: string
  manageUrl: string
}

/** Sent to a subscriber when their approval covers fewer than two more charges. */
export function PayerAllowanceRenewalEmail({
  merchantBusinessName,
  planName,
  amountDisplay,
  renewUrl,
  manageUrl,
}: PayerAllowanceRenewalEmailProps) {
  return (
    <Shell
      preview={`Renew your approval to keep ${planName} with ${merchantBusinessName}`}
      title="Renew your approval"
      subtitle="Subscription"
    >
      <Text style={leadStyle}>
        Your wallet&apos;s approval for <strong>{planName}</strong> from{' '}
        <strong>{merchantBusinessName}</strong> is nearly used up. Renew it to keep your
        subscription going. You approve once in your wallet, and Strimz pays the network fee.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Merchant" value={merchantBusinessName} />
        <DetailRow label="Plan" value={planName} />
        <DetailRow label="Each charge" value={amountDisplay} />
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={renewUrl} style={primaryButtonStyle}>
          Renew approval
        </Button>
      </Section>

      <Text style={secondaryLinkRowStyle}>
        If you don&apos;t renew, the next charges can&apos;t go through and the subscription will
        lapse. Nothing is taken until a charge is due.
      </Text>
      <Text style={secondaryLinkRowStyle}>
        Don&apos;t want it any more?{' '}
        <Link href={manageUrl} style={{ color: colors.link, fontFamily: fonts.body }}>
          Manage or cancel
        </Link>{' '}
        instead.
      </Text>
      <Text style={secondaryLinkRowStyle}>
        Sent by Strimz on behalf of the merchant. Learn more at{' '}
        <Link href="https://strimz.finance" style={{ color: colors.link, fontFamily: fonts.body }}>
          strimz.finance
        </Link>
        .
      </Text>
    </Shell>
  )
}

PayerAllowanceRenewalEmail.PreviewProps = {
  merchantBusinessName: 'Fanline',
  planName: 'Creator Pro',
  amountDisplay: '10.00 USDC',
  renewUrl: 'https://strimz.finance/sub/renew/sub_123',
  manageUrl: 'https://checkout.strimz.finance/manage?subscription=sub_123',
} satisfies PayerAllowanceRenewalEmailProps

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
