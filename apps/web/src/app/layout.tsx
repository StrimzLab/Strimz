import type { Metadata, Viewport } from 'next'
import { Sora, Poppins } from 'next/font/google'
import { Providers } from '@/components/providers'
import { Toaster } from '@strimz/ui'
import { OG_IMAGE, TWITTER_IMAGE } from '@/lib/seo'
import '@/styles/globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://strimz-finance.vercel.app'),
  title: {
    default: 'Strimz. Stablecoin billing infrastructure',
    template: '%s · Strimz',
  },
  description:
    'B2B subscription billing on stablecoins. One API for one-shot payments, recurring charges, refunds, webhooks, and an AI AutoPay Agent. All settled in USDC on Arc.',
  applicationName: 'Strimz',
  keywords: [
    'stablecoin payments',
    'subscription billing',
    'USDC',
    'Arc',
    'b2b payments',
    'crypto billing',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Strimz',
    title: 'Strimz. Stablecoin billing infrastructure',
    description:
      'One API for stablecoin one-shot, subscription, and AI-driven payments. Settled in USDC on Arc.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strimz. Stablecoin billing infrastructure',
    description:
      'One API for stablecoin one-shot, subscription, and AI-driven payments. Settled in USDC on Arc.',
    images: [TWITTER_IMAGE],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${poppins.variable}`}>
      <head>
        {/* Pre-resolve DNS + TLS for Cloudflare Turnstile so the bot-
            check on /signup loads with no network hiccup. */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
