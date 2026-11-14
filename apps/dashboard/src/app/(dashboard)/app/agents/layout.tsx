import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AutoPay Agent',
  description: 'Configure recovery, cashflow, routing, and pricing-intelligence capabilities.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
