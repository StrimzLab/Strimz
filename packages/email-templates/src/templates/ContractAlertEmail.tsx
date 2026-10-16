import { Link, Section, Text } from '@react-email/components'
import * as React from 'react'

import { DetailRow } from '../components/DetailRow.js'
import { Shell } from '../components/Shell.js'
import { colors, fonts, radii } from '../theme.js'

export interface ContractAlertEvent {
  title: string
  details: Array<[label: string, value: string]>
  txUrl: string
}

interface ContractAlertEmailProps {
  network: 'Arc Testnet' | 'Arc Mainnet'
  events: ContractAlertEvent[]
}

export function ContractAlertEmail({ network, events }: ContractAlertEmailProps) {
  return (
    <Shell
      preview={`${events.length} on-chain admin events on ${network}`}
      title="On-chain admin activity"
      subtitle="Contract alert"
      tone="danger"
    >
      <Text style={leadStyle}>
        The indexer saw {events.length} role, upgrade, timelock or pause{' '}
        {events.length === 1 ? 'event' : 'events'} on the Strimz contracts on{' '}
        <strong>{network}</strong>. Check each one against a change you made. Anything you did not
        make means an admin key may be compromised: pause the contracts from the Safe and revoke the
        role.
      </Text>

      {events.map((event, i) => (
        <Section key={i} style={detailBoxStyle}>
          <Text style={titleStyle}>{event.title}</Text>
          {event.details.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} mono />
          ))}
          <Text style={linkRowStyle}>
            <Link href={event.txUrl} style={{ color: colors.link, fontFamily: fonts.mono }}>
              View the transaction on Arcscan
            </Link>
          </Text>
        </Section>
      ))}
    </Shell>
  )
}

ContractAlertEmail.PreviewProps = {
  network: 'Arc Testnet',
  events: [
    {
      title: 'StrimzRegistry: FEE_MANAGER_ROLE granted',
      details: [
        ['Account', '0x00000000000000000000000000000000000000f2'],
        ['Sent by', '0x00000000000000000000000000000000000000f1'],
      ],
      txUrl: `https://explorer.testnet.arc.io/tx/0x${'ab'.repeat(32)}`,
    },
  ],
} as ContractAlertEmailProps

export default ContractAlertEmail

const leadStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: colors.muted,
  margin: '0 0 16px',
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.foreground,
  margin: '8px 0 4px',
}

const detailBoxStyle: React.CSSProperties = {
  background: colors.detailBg,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radii.detail,
  padding: '4px 16px',
  margin: '8px 0',
}

const linkRowStyle: React.CSSProperties = {
  fontSize: 13,
  margin: '4px 0 8px',
}
