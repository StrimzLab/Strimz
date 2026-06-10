import { Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, radii } from '../theme.js'

interface GasBalanceAlertEmailProps {
  /** Human label: "relayer" or "scheduler". */
  role: string
  address: string
  balanceUsdc: string // formatted, e.g. "3.241"
  thresholdUsdc: string // formatted
  network: 'Arc Testnet' | 'Arc Mainnet'
  faucetUrl?: string
}

/**
 * Internal ops alert: a Strimz operator EOA (relayer or scheduler) has
 * dropped below its USDC gas threshold. If not topped up, the next
 * batch of submissions will revert with "insufficient funds for gas",
 * stalling payments or recurring charges silently.
 *
 * Action-oriented copy: the recipient should be able to read the
 * subject line and the first bold sentence and know exactly what to
 * do (top up address X).
 */
export function GasBalanceAlertEmail({
  role,
  address,
  balanceUsdc,
  thresholdUsdc,
  network,
  faucetUrl,
}: GasBalanceAlertEmailProps) {
  return (
    <Shell
      preview={`Strimz ${role} balance is ${balanceUsdc} USDC — top up to keep operations running`}
      title={`Top up the ${role} wallet`}
      subtitle="Low gas balance"
      tone="danger"
    >
      <Text style={leadStyle}>
        The Strimz <strong>{role}</strong> EOA on <strong>{network}</strong> has dropped below the
        gas threshold. Without USDC for fees, the next submission will revert silently and the
        payment / charge flow it serves will stall. Top up to keep operations running.
      </Text>

      <Section style={detailBoxStyle}>
        <DetailRow label="Wallet" value={address} mono />
        <DetailRow label="Current balance" value={`${balanceUsdc} USDC`} />
        <DetailRow label="Alert threshold" value={`${thresholdUsdc} USDC`} />
        <DetailRow label="Network" value={network} />
        {faucetUrl && <DetailRow label="Faucet" value={faucetUrl} />}
      </Section>

      <Text style={leadStyle}>
        This is the only alert that will fire until the wallet rises above the threshold again.
      </Text>
    </Shell>
  )
}

GasBalanceAlertEmail.PreviewProps = {
  role: 'relayer',
  address: '0x8b9370663E68C247Eb1c7fE23e7ea321F146c121',
  balanceUsdc: '3.241',
  thresholdUsdc: '5.000',
  network: 'Arc Testnet',
  faucetUrl: 'https://faucet.circle.com',
} as GasBalanceAlertEmailProps

export default GasBalanceAlertEmail

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
