import type { Metadata, Viewport } from 'next'
import { preconnect } from 'react-dom'
import { RootShell } from '@strimz/web-shared/components/root-shell'
import { OG_IMAGE, TWITTER_IMAGE } from '@strimz/web-shared/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL('https://strimz.finance'),
  title: {
    default: 'Strimz. Stablecoin billing infrastructure',
    template: '%s · Strimz',
  },
  description:
    'Take one-time and subscription payments in USDC and EURC. Every payment lands in your own wallet in seconds, with an on-chain receipt.',
  applicationName: 'Strimz',
  keywords: [
    'stablecoin payments',
    'subscription billing',
    'USDC',
    'EURC',
    'b2b payments',
    'crypto billing',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Strimz',
    title: 'Strimz. Stablecoin billing infrastructure',
    description:
      'One-time and subscription payments in USDC and EURC, paid into your own wallet in seconds.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strimz. Stablecoin billing infrastructure',
    description:
      'One-time and subscription payments in USDC and EURC, paid into your own wallet in seconds.',
    images: [TWITTER_IMAGE],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B12' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Turnstile on the contact form.
  preconnect('https://challenges.cloudflare.com')
  return <RootShell>{children}</RootShell>
}
