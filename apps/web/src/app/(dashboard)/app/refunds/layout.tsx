import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refunds',
  description: 'Issue, sign, and track on-chain refunds against existing transactions.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
