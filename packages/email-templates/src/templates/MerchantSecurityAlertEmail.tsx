import { Button, Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { STRIMZ_ORIGIN, SUPPORT_EMAIL, colors, fonts, radii } from '../theme.js'

export type MerchantSecurityAlertKind = 'payout_change' | 'ownership_transfer'

interface MerchantSecurityAlertEmailProps {
  kind: MerchantSecurityAlertKind
  merchantBusinessName: string | null
  /** The new payout address, or the nominated owner's wallet. */
  address: string
  effectiveAtDisplay: string
  settingsUrl: string
  explorerTxUrl: string
}

const COPY: Record<
  MerchantSecurityAlertKind,
  { title: string; preview: string; what: string; label: string }
> = {
  payout_change: {
    title: 'Your payout address is changing',
    preview: 'A new payout address takes effect in 24 hours',
    what: 'your payout address is changing. From the time below, every payment and subscription charge goes to the new address.',
    label: 'New payout address',
  },
  ownership_transfer: {
    title: 'Your merchant account is being handed over',
    preview: 'A new owner can take over your merchant account in 24 hours',
    what: 'a new wallet has been nominated as the owner of your merchant account. From the time below it can accept, and then it controls your payout address.',
    label: 'Nominated owner',
  },
}

export function MerchantSecurityAlertEmail({
  kind,
  merchantBusinessName,
  address,
  effectiveAtDisplay,
  settingsUrl,
  explorerTxUrl,
}: MerchantSecurityAlertEmailProps) {
  const copy = COPY[kind]
  return (
    <Shell preview={copy.preview} title={copy.title} subtitle="Account security" tone="danger">
      <Text style={leadStyle}>
        Hi {merchantBusinessName ?? 'there'}, {copy.what} It was started from your merchant owner
        wallet.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label={copy.label} value={address} />
        <DetailRow label="Takes effect" value={effectiveAtDisplay} />
      </Section>

      <Text style={leadStyle}>If this was you, there is nothing to do.</Text>

      {kind === 'payout_change' ? (
        <>
          <Text style={leadStyle}>
            If this wasn&apos;t you, cancel it before then under Settings, On-chain policy.
          </Text>
          <Section style={{ textAlign: 'center', margin: '8px 0 8px' }}>
            <Button href={settingsUrl} style={primaryButtonStyle}>
              Review and cancel
            </Button>
          </Section>
        </>
      ) : (
        <Text style={leadStyle}>
          If this wasn&apos;t you, email{' '}
          <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: colors.link }}>
            {SUPPORT_EMAIL}
          </Link>{' '}
          straight away so we can cancel it before then.
        </Text>
      )}

      <Text style={secondaryLinkRowStyle}>
        Transaction:{' '}
        <Link href={explorerTxUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
          view on Arcscan
        </Link>
      </Text>
    </Shell>
  )
}

MerchantSecurityAlertEmail.PreviewProps = {
  kind: 'payout_change',
  merchantBusinessName: 'Smoke Test Co',
  address: '0x00000000000000000000000000000000000000d1',
  effectiveAtDisplay: '31 Oct 2026, 14:00 UTC',
  settingsUrl: `${STRIMZ_ORIGIN}/app/settings`,
  explorerTxUrl: `https://explorer.testnet.arc.io/tx/0x${'4d'.repeat(32)}`,
} as MerchantSecurityAlertEmailProps

export default MerchantSecurityAlertEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 16px',
}

const detailBoxStyle: React.CSSProperties = {
  background: colors.detailBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radii.detail,
  padding: '4px 16px',
  margin: '8px 0 16px',
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
