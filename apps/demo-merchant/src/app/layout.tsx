import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { StrimzClientProvider } from '@/components/StrimzClientProvider'
import './globals.css'

const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const TITLE = 'Fanline. Back the creators you love'
const DESCRIPTION =
  'Tip a musician in Lagos, a comic in Accra or a podcaster in Nairobi, or join Fanline Pro. A live demo of Strimz payments on testnet.'

export const metadata: Metadata = {
  metadataBase: new URL('https://fanline.strimz.finance'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Fanline',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfaff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0819' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <StrimzClientProvider>{children}</StrimzClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
