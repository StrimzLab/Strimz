import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscribe',
  description: 'Authorize a recurring USDC subscription on Arc — one signature, then automatic.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
