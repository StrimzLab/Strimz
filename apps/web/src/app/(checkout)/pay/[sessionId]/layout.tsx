import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complete payment',
  description: 'Connect your wallet and pay with USDC on Arc.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
