import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Volume, MRR, retention, and webhook health for your merchant account.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
