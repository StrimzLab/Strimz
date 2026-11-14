import type { Metadata, Viewport } from 'next'
import { RootShell } from '@strimz/web-shared/components/root-shell'
import { OG_IMAGE, TWITTER_IMAGE } from '@strimz/web-shared/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.strimz.finance'),
  title: { default: 'Strimz Docs', template: '%s · Strimz Docs' },
  description: 'Guides and API reference for taking USDC and EURC payments with Strimz.',
  openGraph: { type: 'website', siteName: 'Strimz Docs', images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', images: [TWITTER_IMAGE] },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B12' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>
}
