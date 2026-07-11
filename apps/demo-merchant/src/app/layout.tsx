import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { StrimzClientProvider } from '@/components/StrimzClientProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fanline — Support the creators you love',
  description:
    'Tip and subscribe to your favourite creators. Paid in USDC, settles on Arc in seconds. A demo dApp built on Strimz.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <StrimzClientProvider>{children}</StrimzClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
