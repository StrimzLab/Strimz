import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API keys',
  description: 'Manage publishable and secret keys for the Strimz SDK.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
