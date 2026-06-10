import { Column, Row, Text } from '@react-email/components'
import * as React from 'react'

import { colors, fonts } from '../theme.js'

interface DetailRowProps {
  label: string
  /** Renders as text by default. Pass `mono` for hashes / IDs. */
  value: string
  mono?: boolean
}

/**
 * One key-value row inside an email's detail block.
 *
 * React Email's `Row`/`Column` are the only thing that renders right
 * in Outlook desktop without falling back to a table. Using them keeps
 * the markup gmail/Outlook/AppleMail safe.
 */
export function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <Row style={{ borderBottom: `1px solid ${colors.cardBorder}` }}>
      <Column style={{ padding: '10px 0', width: '40%' }}>
        <Text style={labelStyle}>{label}</Text>
      </Column>
      <Column style={{ padding: '10px 0', width: '60%', textAlign: 'right' }}>
        <Text style={{ ...valueStyle, fontFamily: mono ? fonts.mono : fonts.body }}>{value}</Text>
      </Column>
    </Row>
  )
}

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: colors.muted,
  fontWeight: 400,
}

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: colors.foreground,
  fontWeight: 500,
  wordBreak: 'break-all',
}
