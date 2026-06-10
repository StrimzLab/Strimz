import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Customers paying you on Strimz, with their wallets, history, and lifetime value.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
