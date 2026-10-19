import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customers',
  description:
    'Customers paying you on Strimz: their wallets, emails and everything they have paid.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
