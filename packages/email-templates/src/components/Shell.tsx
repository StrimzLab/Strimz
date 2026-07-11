import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

import {
  LOGO_URL,
  STRIMZ_BRAND_DISPLAY,
  STRIMZ_BRAND_URL,
  SUPPORT_EMAIL,
  colors,
  fonts,
  radii,
} from '../theme.js'

interface ShellProps {
  /** Short string shown in the inbox preview pane (≤90 chars). */
  preview: string
  /** Title rendered as the email's `<h1>`. */
  title: string
  /** Optional brand-pill sub-line under the title. */
  subtitle?: string
  /** Status pill colour: `success` for ops-OK events, `danger` for alerts. */
  tone?: 'success' | 'danger'
  children: React.ReactNode
}

/**
 * Base layout every Strimz transactional email composes against.
 *
 * Why shared shell: every recipient sees the same logo placement, the
 * same header weight, the same footer. Per-template authors only think
 * about the middle. Brand changes (logo, accent, footer copy) are one
 * file edit, not 12.
 */
export function Shell({ preview, title, subtitle, tone = 'success', children }: ShellProps) {
  const pillBg = tone === 'success' ? colors.primarySoft : colors.dangerSoft
  const pillBorder = tone === 'success' ? colors.primaryBorder : colors.dangerBorder
  const pillFg = tone === 'success' ? colors.primary : colors.danger

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={{ paddingBottom: 24 }}>
            <Img src={LOGO_URL} width={96} height={28} alt="Strimz" />
          </Section>

          {subtitle && (
            <Section
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                marginBottom: 16,
                borderRadius: radii.pill,
                background: pillBg,
                border: `1px solid ${pillBorder}`,
              }}
            >
              <Text
                style={{
                  margin: 0,
                  color: pillFg,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 0.2,
                }}
              >
                {subtitle}
              </Text>
            </Section>
          )}

          <Heading as="h1" style={headingStyle}>
            {title}
          </Heading>

          {/* React 19 widened `ReactNode` to include `Promise<ReactNode>` for
              Server Components. `@react-email/components` was compiled
              against an older `@types/react` whose `ReactNode` doesn't
              accept the widened one, and every attempted structural cast
              hits the same wall. The values are always synchronous React
              elements at runtime — the `any` cast is scoped tightly to
              this render slot. */}
          {children as never}

          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            Questions? Reply to this email or write to{' '}
            <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: colors.link }}>
              {SUPPORT_EMAIL}
            </Link>
            .
          </Text>
          <Text style={footerStyle}>
            Sent by Strimz —{' '}
            <Link href={STRIMZ_BRAND_URL} style={{ color: colors.link }}>
              {STRIMZ_BRAND_DISPLAY}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle: React.CSSProperties = {
  background: colors.page,
  fontFamily: fonts.body,
  margin: 0,
  padding: '32px 12px',
}

const containerStyle: React.CSSProperties = {
  margin: '0 auto',
  maxWidth: 560,
  background: colors.card,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radii.card,
  padding: '32px 28px',
  color: colors.foreground,
}

const headingStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  margin: '0 0 16px',
  color: colors.foreground,
}

const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: `1px solid ${colors.cardBorder}`,
  margin: '28px 0 16px',
}

const footerStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: colors.subtle,
  margin: '4px 0',
}
