import type { Metadata, Viewport } from 'next'
import { RootShell } from '@strimz/web-shared/components/root-shell'
import { ClientProviders } from '@/components/client-providers'

export const metadata: Metadata = {
  title: { default: 'Strimz', template: '%s · Strimz' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#050020' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell>
      <ClientProviders>{children}</ClientProviders>
    </RootShell>
  )
}
